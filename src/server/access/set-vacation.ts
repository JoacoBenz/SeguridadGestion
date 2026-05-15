import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

const Input = z.object({
  userId: z.string().min(1),
  start: z.date().nullable(),
  end: z.date().nullable(),
});

export type SetVacationInput = z.infer<typeof Input>;

export async function setVacation(raw: SetVacationInput) {
  const input = Input.parse(raw);

  if (input.start && input.end && input.end <= input.start) {
    throw new Error("INVALID_VACATION_RANGE");
  }
  if (input.start && !input.end) throw new Error("MISSING_VACATION_END");
  if (!input.start && input.end) throw new Error("MISSING_VACATION_START");

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      vacationStart: input.start,
      vacationEnd: input.end,
    },
  });
  await recordAudit({
    tenantId: user.tenantId,
    actorUserId: input.userId,
    action: input.start ? "user.vacation_set" : "user.vacation_cleared",
    entityType: "User",
    entityId: input.userId,
    metadata: {
      start: input.start?.toISOString() ?? null,
      end: input.end?.toISOString() ?? null,
    },
  });
  return updated;
}
