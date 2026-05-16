import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";

const Input = z.object({
  tenantId: z.string().min(1),
  issueId: z.string().min(1),
});

export async function acknowledgeIssue(raw: z.infer<typeof Input>) {
  const input = Input.parse(raw);
  const session = await requireTenantRole(input.tenantId, ["admin", "guard"]);
  const issue = await prisma.issue.findFirst({
    where: { id: input.issueId, tenantId: input.tenantId },
  });
  if (!issue) throw new Error("ISSUE_NOT_FOUND");
  if (issue.status !== "open") return issue;
  const updated = await prisma.issue.update({
    where: { id: input.issueId },
    data: {
      status: "acknowledged",
      acknowledgedByUserId: session.userId,
      acknowledgedAt: new Date(),
    },
  });
  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "issue.acknowledged",
    entityType: "Issue",
    entityId: issue.id,
  });
  return updated;
}
