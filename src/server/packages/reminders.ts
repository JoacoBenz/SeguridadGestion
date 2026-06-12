import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isTenantOperational } from "@/lib/subscription";
import { getWhatsAppClient } from "@/lib/whatsapp/client";
import { isReminderDue, reminderCutoff } from "./reminder-policy";

export interface ReminderRunResult {
  scanned: number;
  remindersSent: number;
  packagesSkipped: number;
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
        select: { id: true, name: true, subscriptionStatus: true, trialEndsAt: true },
      },
      unit: {
        include: {
          residents: { include: { user: { select: { name: true, phone: true } } } },
        },
      },
      notifications: {
        where: { templateName: "paquete_pendiente_v1" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const whatsapp = getWhatsAppClient();
  let remindersSent = 0;
  let packagesSkipped = 0;

  for (const pkg of candidates) {
    const lastReminderAt = pkg.notifications[0]?.createdAt ?? null;
    if (!isTenantOperational(pkg.tenant, now) || !isReminderDue(pkg.receivedAt, lastReminderAt, now)) {
      packagesSkipped++;
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
        await prisma.notification.create({
          data: {
            packageId: pkg.id,
            channel: "whatsapp",
            templateName: "paquete_pendiente_v1",
            recipientPhone: phone,
            status: "failed",
            errorPayload: { message: err instanceof Error ? err.message : String(err) },
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

  return { scanned: candidates.length, remindersSent, packagesSkipped };
}
