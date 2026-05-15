import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getWhatsAppClient } from "@/lib/whatsapp/client";

const Input = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1).optional(),
  kind: z.enum(["maintenance", "noise", "suspicious", "panic", "incident"]),
  body: z.string().min(3).max(2000),
  severity: z.enum(["low", "normal", "high", "critical"]).optional(),
  reporterUserId: z.string().min(1),
});

export type ReportIssueInput = z.infer<typeof Input>;

function titleFrom(body: string): string {
  return body.length > 80 ? body.slice(0, 77) + "…" : body;
}

export async function reportIssue(raw: ReportIssueInput) {
  const input = Input.parse(raw);

  const reporter = await prisma.user.findUnique({ where: { id: input.reporterUserId } });
  if (!reporter) throw new Error("REPORTER_NOT_FOUND");

  // Panic always escalates.
  const severity =
    input.kind === "panic" ? "critical" : (input.severity ?? "normal");

  // Resolve unitId for residents from their primary unit if not provided.
  let unitId = input.unitId ?? null;
  if (!unitId && reporter.role === "resident") {
    const membership = await prisma.unitResident.findFirst({
      where: { userId: reporter.id },
      select: { unitId: true },
    });
    unitId = membership?.unitId ?? null;
  }

  const issue = await prisma.issue.create({
    data: {
      tenantId: input.tenantId,
      unitId: unitId ?? undefined,
      kind: input.kind,
      severity,
      status: "open",
      title: titleFrom(input.body),
      body: input.body,
      reportedByUserId: input.reporterUserId,
      reportedByRole: reporter.role,
    },
  });

  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: input.reporterUserId,
    action: "issue.reported",
    entityType: "Issue",
    entityId: issue.id,
    metadata: { kind: input.kind, severity, unitId },
  });

  // Critical issues fan out to all admins of the tenant.
  if (severity === "critical") {
    await notifyAdminsOfCritical(input.tenantId, issue.id, input.body);
  }

  return issue;
}

async function notifyAdminsOfCritical(tenantId: string, issueId: string, body: string) {
  const [tenant, admins] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    prisma.user.findMany({
      where: { tenantId, role: "admin" },
      select: { id: true, name: true, phone: true },
    }),
  ]);
  if (!tenant) return;

  const shortDesc = body.length > 120 ? body.slice(0, 117) + "…" : body;
  const whatsapp = getWhatsAppClient();

  for (const admin of admins) {
    if (!admin.phone) continue;
    try {
      await whatsapp.sendTemplate({
        to: admin.phone,
        template: "incidente_aviso_v1",
        params: [admin.name, tenant.name, shortDesc],
      });
    } catch (err) {
      console.error("[issues] notify admin failed", admin.id, err);
    }
  }

  await recordAudit({
    tenantId,
    actorUserId: null,
    action: "issue.admins_notified",
    entityType: "Issue",
    entityId: issueId,
    metadata: { adminCount: admins.length },
  });
}
