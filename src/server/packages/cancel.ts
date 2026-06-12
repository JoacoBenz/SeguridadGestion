import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";

const CancelInput = z.object({
  tenantId: z.string().min(1),
  packageId: z.string().min(1),
  reason: z.string().min(1).max(300),
});

export type CancelInput = z.infer<typeof CancelInput>;

export async function cancelPackage(raw: CancelInput): Promise<void> {
  const input = CancelInput.parse(raw);
  const session = await requireTenantRole(input.tenantId, ["guard", "admin"]);

  const pkg = await prisma.package.findFirst({
    where: { id: input.packageId, tenantId: input.tenantId },
    select: { id: true, status: true },
  });
  if (!pkg) throw new Error("PACKAGE_NOT_FOUND");
  if (pkg.status !== "awaiting_pickup") throw new Error("PACKAGE_NOT_CANCELLABLE");

  // Conditional update: if the package was picked up between the check above
  // and this write, the cancel must lose instead of clobbering the pickup.
  const updated = await prisma.package.updateMany({
    where: { id: pkg.id, status: "awaiting_pickup" },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledReason: input.reason,
    },
  });
  if (updated.count === 0) throw new Error("PACKAGE_NOT_CANCELLABLE");

  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "package.cancelled",
    entityType: "Package",
    entityId: pkg.id,
    metadata: { reason: input.reason },
  });
}
