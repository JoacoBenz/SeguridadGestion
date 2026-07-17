import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getWhatsAppClient } from "@/lib/whatsapp/client";

// Recordatorio para paquetes pendientes hace más de 3 días. Pensado para un
// Vercel Cron (GET diario). Auth por CRON_SECRET (Vercel manda
// `Authorization: Bearer <CRON_SECRET>`); sin secret configurado solo corre en dev.
// Re-recuerda como mucho cada 3 días por paquete (mira la última notificación
// paquete_pendiente_v1).
//
// Escalamiento: cuando un paquete ya recibió `escalateAfter` recordatorios (default 2)
// y sigue sin retirarse, en vez de otro recordatorio al residente se avisa UNA vez
// a los admins del edificio (paquete_escalado_v1). El umbral se configura por tenant
// en Tenant.settings.reminderEscalateAfter.

const REMINDER_AFTER_DAYS = 3;
const DEFAULT_ESCALATE_AFTER = 2;

function escalateThreshold(settings: unknown): number {
  if (settings && typeof settings === "object" && "reminderEscalateAfter" in settings) {
    const v = (settings as Record<string, unknown>).reminderEscalateAfter;
    if (typeof v === "number" && v > 0) return v;
  }
  return DEFAULT_ESCALATE_AFTER;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET_NOT_SET" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const stale = await prisma.package.findMany({
    where: {
      status: "awaiting_pickup",
      receivedAt: { lte: cutoff },
      notifications: {
        none: { templateName: "paquete_pendiente_v1", createdAt: { gt: cutoff } },
      },
    },
    include: {
      tenant: { select: { settings: true } },
      unit: {
        include: {
          residents: { include: { user: { select: { name: true, phone: true } } } },
        },
      },
      notifications: {
        where: { templateName: { in: ["paquete_pendiente_v1", "paquete_escalado_v1"] } },
        select: { templateName: true },
      },
    },
    take: 200,
  });

  const whatsapp = getWhatsAppClient();
  let sent = 0;
  let failed = 0;
  let escalated = 0;

  for (const pkg of stale) {
    const receivedDate = pkg.receivedAt.toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    const priorReminders = pkg.notifications.filter(
      (n) => n.templateName === "paquete_pendiente_v1",
    ).length;
    const alreadyEscalated = pkg.notifications.some(
      (n) => n.templateName === "paquete_escalado_v1",
    );
    const threshold = escalateThreshold(pkg.tenant.settings);

    // ¿Escalar? Ya se recordó suficiente y no se avisó al admin todavía.
    if (priorReminders >= threshold && !alreadyEscalated) {
      const admins = await prisma.user.findMany({
        where: { tenantId: pkg.tenantId, role: "admin", phone: { not: null } },
        select: { phone: true },
      });
      let escalatedThisPkg = false;
      for (const admin of admins) {
        try {
          const result = await whatsapp.sendTemplate({
            to: admin.phone!,
            template: "paquete_escalado_v1",
            params: [pkg.unit.label, receivedDate, String(priorReminders)],
          });
          await prisma.notification.create({
            data: {
              packageId: pkg.id,
              channel: "whatsapp",
              templateName: "paquete_escalado_v1",
              recipientPhone: admin.phone!,
              providerMessageId: result.providerMessageId,
              status: "sent",
              sentAt: new Date(),
            },
          });
          sent++;
          escalatedThisPkg = true;
        } catch (err) {
          await prisma.notification.create({
            data: {
              packageId: pkg.id,
              channel: "whatsapp",
              templateName: "paquete_escalado_v1",
              recipientPhone: admin.phone!,
              status: "failed",
              errorPayload: { message: err instanceof Error ? err.message : String(err) },
            },
          });
          failed++;
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
          metadata: { priorReminders, threshold },
        });
      }
      continue; // no mandar recordatorio de residente si escalamos.
    }

    // Recordatorio normal al residente.
    let notifiedAny = false;
    for (const membership of pkg.unit.residents) {
      const phone = membership.user.phone;
      if (!phone) continue;
      try {
        const result = await whatsapp.sendTemplate({
          to: phone,
          template: "paquete_pendiente_v1",
          params: [receivedDate],
        });
        await prisma.notification.create({
          data: {
            packageId: pkg.id,
            channel: "whatsapp",
            templateName: "paquete_pendiente_v1",
            recipientPhone: phone,
            providerMessageId: result.providerMessageId,
            status: "sent",
            sentAt: new Date(),
          },
        });
        sent++;
        notifiedAny = true;
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
        failed++;
      }
    }

    if (notifiedAny) {
      await recordAudit({
        tenantId: pkg.tenantId,
        actorUserId: null,
        action: "package.reminder_sent",
        entityType: "Package",
        entityId: pkg.id,
        metadata: { daysPending: REMINDER_AFTER_DAYS, priorReminders },
      });
    }
  }

  return NextResponse.json({ candidates: stale.length, sent, failed, escalated });
}
