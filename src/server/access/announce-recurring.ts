import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const Input = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  createdByUserId: z.string().min(1),
  name: z.string().min(1).max(120),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startTime: z.string().regex(HHMM),
  endTime: z.string().regex(HHMM),
  validUntil: z.date().nullable().optional(),
});

export type CreateRecurringAuthInput = z.infer<typeof Input>;

export async function createRecurringAuthorization(raw: CreateRecurringAuthInput) {
  const input = Input.parse(raw);
  const auth = await prisma.recurringAuthorization.create({
    data: {
      tenantId: input.tenantId,
      unitId: input.unitId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      daysOfWeek: input.daysOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      validUntil: input.validUntil ?? undefined,
      status: "active",
    },
  });
  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: input.createdByUserId,
    action: "recurring_auth.created",
    entityType: "RecurringAuthorization",
    entityId: auth.id,
    metadata: {
      name: input.name,
      daysOfWeek: input.daysOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });
  return auth;
}
