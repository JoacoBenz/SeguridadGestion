import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isTenantOperational } from "@/lib/subscription";
import { getWhatsAppClient } from "@/lib/whatsapp/client";
import { isReminderDue, reminderCutoff } from "./reminder-policy";

export interface ReminderRunResult {
  scanned: number;
  remindersSent: number;
  packagesSkipped: number;
  escalated: number;
}

const DEFAULT_ESCALATE_AFTER = 2;

// Umbral de escalamiento por tenant (Tenant.settings.reminderEscalateAfter),
// con default. Cuando un paquete ya recibió >= umbral recordatorios y sigue sin
// retirarse, se avisa una vez a los admins en lugar de seguir insistiendo al
// residente.
function escalateThreshold(settings: unknown): number {
  if (settings && typeof settings === "object" && "reminderEscalateAfter" in settings) {
    const v = (settings as Record<string, unknown>).reminderEscalateAfter;
    if (typeof v === "number" && v > 0) return v;
  }
  return DEFAULT_ESCALATE_AFTER;
}

// Recorre paquetes pendientes viejos y reenvía paquete_pendiente_v1 a los
// residentes. Idempotente entre corridas: el cooldown se deduce de la última
// Notification con ese template, así que correrlo dos veces no duplica.
// `limit` acota la corrida para no exceder el tiempo de un serverless.
export async function sendPendingReminders(
  now: Date = new Date(),
  limit = 50,
): Promise<ReminderRunResult> {
  const candidates = await prisma.package.findMany({
    where: {
      status: "awaiting_pickup",
      receivedAt: { lte: reminderCutoff(now) },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          settings: true,
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      },
      unit: {
        include: {
          residents: { include: { user: { select: { name: true, phone: true } } } },
        },
      },
      notifications: {
        where: { templateName: { in: ["paquete_pendiente_v1", "paquete_escalado_v1"] } },
        orderBy: { createdAt: "desc" },
        select: { templateName: true, createdAt: true },
      },
    },
  });

  const whatsapp = getWhatsAppClient();
  let remindersSent = 0;
  let packagesSkipped = 0;
  let escalated = 0;

  for (const pkg of candidates) {
    const reminderNotifs = pkg.notifications.filter(
      (n) => n.templateName === "paquete_pendiente_v1",
    );
    const lastReminderAt = reminderNotifs[0]?.createdAt ?? null;
    if (!isTenantOperational(pkg.tenant, now) || !isReminderDue(pkg.receivedAt, lastReminderAt, now)) {
      packagesSkipped++;
      continue;
    }

    // Escalar al admin (una sola vez) cuando ya se recordó suficiente.
    const priorReminders = reminderNotifs.length;
    const alreadyEscalated = pkg.notifications.some(
      (n) => n.templateName === "paquete_escalado_v1",
    );
    if (priorReminders >= escalateThreshold(pkg.tenant.settings) && !alreadyEscalated) {
      const admins = await prisma.user.findMany({
        where: { tenantId: pkg.tenantId, role: "admin", phone: { not: null } },
        select: { phone: true },
      });
      let escalatedThisPkg = false;
      for (const admin of admins) {
        try {
          const sent = await whatsapp.sendTemplate({
            to: admin.phone!,
            template: "paquete_escalado_v1",
            params: [
              pkg.unit.label,
              pkg.receivedAt.toLocaleDateString("es-AR"),
              String(priorReminders),
            ],
          });
          await prisma.notification.create({
            data: {
              packageId: pkg.id,
              channel: "whatsapp",
              templateName: "paquete_escalado_v1",
              recipientPhone: admin.phone!,
              providerMessageId: sent.providerMessageId,
              status: "sent",
              sentAt: new Date(),
            },
          });
          escalatedThisPkg = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[whatsapp] paquete_escalado_v1 falló para ${admin.phone} (package ${pkg.id}): ${message}`,
          );
          await prisma.notification.create({
            data: {
              packageId: pkg.id,
              channel: "whatsapp",
              templateName: "paquete_escalado_v1",
              recipientPhone: admin.phone!,
              status: "failed",
              errorPayload: { message },
            },
          });
        }
      }
      if (escalatedThisPkg) {
        escalated++;
        await recordAudit({
          tenantId: pkg.tenantId,
          actorUserId: null,
          action: "package.reminder_escalated",
          entityType: "Package",
          entityId: pkg.id,
          metadata: { priorReminders },
        });
      } else {
        packagesSkipped++;
      }
      continue;
    }

    let sentForPackage = 0;
    for (const membership of pkg.unit.residents) {
      const phone = membership.user.phone;
      if (!phone) continue;
      try {
        const sent = await whatsapp.sendTemplate({
          to: phone,
          template: "paquete_pendiente_v1",
          params: [pkg.receivedAt.toLocaleDateString("es-AR")],
        });
        await prisma.notification.create({
          data: {
            packageId: pkg.id,
            channel: "whatsapp",
            templateName: "paquete_pendiente_v1",
            recipientPhone: phone,
            providerMessageId: sent.providerMessageId,
            status: "sent",
            sentAt: new Date(),
          },
        });
        sentForPackage++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[whatsapp] paquete_pendiente_v1 falló para ${phone} (package ${pkg.id}): ${message}`,
        );
        await prisma.notification.create({
          data: {
            packageId: pkg.id,
            channel: "whatsapp",
            templateName: "paquete_pendiente_v1",
            recipientPhone: phone,
            status: "failed",
            errorPayload: { message },
          },
        });
      }
    }

    if (sentForPackage > 0) {
      remindersSent += sentForPackage;
      await recordAudit({
        tenantId: pkg.tenantId,
        actorUserId: null,
        action: "package.reminder_sent",
        entityType: "Package",
        entityId: pkg.id,
        metadata: { recipients: sentForPackage, receivedAt: pkg.receivedAt.toISOString() },
      });
    } else {
      packagesSkipped++;
    }
  }

  return { scanned: candidates.length, remindersSent, packagesSkipped, escalated };
}
