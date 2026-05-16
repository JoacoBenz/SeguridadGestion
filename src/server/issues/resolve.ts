import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";

const Input = z.object({
  tenantId: z.string().min(1),
  issueId: z.string().min(1),
  note: z.string().min(1).max(500),
});

export async function resolveIssue(raw: z.infer<typeof Input>) {
  const input = Input.parse(raw);
  const session = await requireTenantRole(input.tenantId, ["admin", "guard"]);
  const issue = await prisma.issue.findFirst({
    where: { id: input.issueId, tenantId: input.tenantId },
  });
  if (!issue) throw new Error("ISSUE_NOT_FOUND");
  if (issue.status === "resolved") return issue;
  const updated = await prisma.issue.update({
    where: { id: input.issueId },
    data: {
      status: "resolved",
      resolvedByUserId: session.userId,
      resolvedAt: new Date(),
      resolutionNote: input.note,
    },
  });
  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "issue.resolved",
    entityType: "Issue",
    entityId: issue.id,
    metadata: { note: input.note },
  });
  return updated;
}
