import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";

const Input = z.object({
  tenantId: z.string().min(1),
  authorizationId: z.string().min(1),
});

export async function pauseRecurringAuthorization(raw: z.infer<typeof Input>) {
  const input = Input.parse(raw);
  const session = await requireTenantRole(input.tenantId, ["admin"]);
  const auth = await prisma.recurringAuthorization.findFirst({
    where: { id: input.authorizationId, tenantId: input.tenantId },
  });
  if (!auth) throw new Error("RECURRING_AUTH_NOT_FOUND");
  const updated = await prisma.recurringAuthorization.update({
    where: { id: input.authorizationId },
    data: { status: "paused" },
  });
  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "recurring_auth.paused",
    entityType: "RecurringAuthorization",
    entityId: auth.id,
  });
  return updated;
}

export async function revokeRecurringAuthorization(raw: z.infer<typeof Input>) {
  const input = Input.parse(raw);
  const session = await requireTenantRole(input.tenantId, ["admin"]);
  const auth = await prisma.recurringAuthorization.findFirst({
    where: { id: input.authorizationId, tenantId: input.tenantId },
  });
  if (!auth) throw new Error("RECURRING_AUTH_NOT_FOUND");
  const updated = await prisma.recurringAuthorization.update({
    where: { id: input.authorizationId },
    data: { status: "revoked" },
  });
  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "recurring_auth.revoked",
    entityType: "RecurringAuthorization",
    entityId: auth.id,
  });
  return updated;
}
