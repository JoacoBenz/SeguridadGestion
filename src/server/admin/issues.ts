"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { acknowledgeIssue } from "@/server/issues/acknowledge";
import { resolveIssue } from "@/server/issues/resolve";
import { reportIssue } from "@/server/issues/report";

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

export async function acknowledgeIssueAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const id = formData.get("issueId");
  if (typeof id !== "string" || !id) {
    redirect(`/${slug}/admin/incidentes?error=${encodeURIComponent("Falta id")}`);
  }
  try {
    await acknowledgeIssue({ tenantId, issueId: id });
  } catch (err) {
    redirect(
      `/${slug}/admin/incidentes?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }
  redirect(`/${slug}/admin/incidentes?ok=visto`);
}

const ResolveInput = z.object({
  issueId: z.string().min(1),
  note: z.string().trim().min(1).max(500),
});

export async function resolveIssueAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const parsed = ResolveInput.safeParse({
    issueId: formData.get("issueId"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/incidentes?error=${encodeURIComponent("Falta nota de resolución")}`,
    );
  }
  try {
    await resolveIssue({ tenantId, issueId: parsed.data.issueId, note: parsed.data.note });
  } catch (err) {
    redirect(
      `/${slug}/admin/incidentes?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }
  redirect(`/${slug}/admin/incidentes?ok=resuelto`);
}

const GuardReportInput = z.object({
  kind: z.enum(["maintenance", "noise", "suspicious", "incident"]),
  unitId: z.string().optional(),
  body: z.string().trim().min(3).max(2000),
});

// Guard-side report from the conserjería floating button. Lives here to share
// the redirect convention; allowed for guard or admin.
export async function guardReportIssueAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["guard", "admin"]);
  const parsed = GuardReportInput.safeParse({
    kind: formData.get("kind"),
    unitId: formData.get("unitId") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/conserjeria?error=${encodeURIComponent("Datos inválidos para reportar incidente")}`,
    );
  }
  try {
    await reportIssue({
      tenantId,
      reporterUserId: session.userId,
      kind: parsed.data.kind,
      unitId: parsed.data.unitId,
      body: parsed.data.body,
    });
  } catch (err) {
    redirect(
      `/${slug}/conserjeria?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }
  redirect(`/${slug}/conserjeria?ok=incidente-registrado`);
}
