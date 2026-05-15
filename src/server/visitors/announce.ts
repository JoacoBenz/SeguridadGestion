import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

const Input = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  requestedByUserId: z.string().min(1),
  visitorName: z.string().min(1).max(120),
  expectedTime: z.date().nullable(),
  vehiclePlate: z.string().max(20).nullable(),
});

export type AnnounceVisitorInput = z.infer<typeof Input>;

// Called from the chat dispatcher after a resident confirms via WhatsApp.
// Auth comes from phone match in the webhook (not a tenant-role check).
export async function announceVisitor(raw: AnnounceVisitorInput) {
  const input = Input.parse(raw);
  const event = await prisma.visitorEvent.create({
    data: {
      tenantId: input.tenantId,
      unitId: input.unitId,
      kind: "announced",
      visitorName: input.visitorName,
      expectedTime: input.expectedTime ?? undefined,
      vehiclePlate: input.vehiclePlate ?? undefined,
      status: "confirmed",
      requestedByUserId: input.requestedByUserId,
    },
  });
  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: input.requestedByUserId,
    action: "visitor.announced",
    entityType: "VisitorEvent",
    entityId: event.id,
    metadata: { visitorName: input.visitorName, vehiclePlate: input.vehiclePlate ?? null },
  });
  return event;
}
