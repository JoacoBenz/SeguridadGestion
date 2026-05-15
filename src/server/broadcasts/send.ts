import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";
import { getWhatsAppClient } from "@/lib/whatsapp/client";

// Meta's WhatsApp body parameter cap is 1024 chars; enforce before fanout.
const Input = z.object({
  tenantId: z.string().min(1),
  subject: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(900),
});

export type SendBroadcastInput = z.infer<typeof Input>;

export async function sendBroadcast(raw: SendBroadcastInput) {
  const input = Input.parse(raw);
  const session = await requireTenantRole(input.tenantId, ["admin"]);

  const [tenant, residents] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: input.tenantId }, select: { name: true } }),
    prisma.user.findMany({
      where: { tenantId: input.tenantId, role: "resident", phone: { not: null } },
      select: { id: true, name: true, phone: true },
    }),
  ]);
  if (!tenant) throw new Error("TENANT_NOT_FOUND");

  const whatsapp = getWhatsAppClient();
  let sent = 0;
  let failed = 0;

  for (const r of residents) {
    if (!r.phone) continue;
    try {
      await whatsapp.sendTemplate({
        to: r.phone,
        template: "aviso_general_v1",
        params: [r.name, tenant.name, input.body],
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error("[broadcast] send failed", r.id, err);
    }
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      tenantId: input.tenantId,
      sentByUserId: session.userId,
      subject: input.subject,
      body: input.body,
      recipientCount: sent,
    },
  });

  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "broadcast.sent",
    entityType: "Broadcast",
    entityId: broadcast.id,
    metadata: { sent, failed, subject: input.subject },
  });

  return { broadcast, sent, failed };
}
