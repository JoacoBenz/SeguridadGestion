"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRole, requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const SetInput = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  start: z.date(),
  end: z.date(),
}).refine((v) => v.start <= v.end, {
  message: "El inicio tiene que ser anterior o igual al fin",
  path: ["end"],
});

export type SetVacationInput = z.infer<typeof SetInput>;

// Llamable desde el dispatcher del chat (el resident pasa su propio userId).
export async function setVacation(raw: SetVacationInput): Promise<void> {
  const input = SetInput.parse(raw);
  const session = await requireSession();

  // Permite que el propio resident o un admin del mismo tenant setee.
  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId },
    select: { id: true, tenantId: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (session.role !== "superadmin") {
    const sameTenant = session.tenantId === user.tenantId;
    const isSelf = session.userId === user.id;
    const isAdminOfTenant = session.role === "admin" && sameTenant;
    if (!isSelf && !isAdminOfTenant) throw new Error("FORBIDDEN_TENANT");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { vacationStart: input.start, vacationEnd: input.end },
  });

  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "user.vacation_set",
    entityType: "User",
    entityId: user.id,
    metadata: { start: input.start.toISOString(), end: input.end.toISOString() },
  });
}

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

// Form admin: setea vacaciones para un residente del tenant.
export async function setVacationAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  await requireTenantRole(tenantId, ["admin"]);

  const userId = (formData.get("userId") ?? "").toString();
  const startRaw = (formData.get("start") ?? "").toString();
  const endRaw = (formData.get("end") ?? "").toString();

  if (!userId) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Falta residente")}`);
  }
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Fecha inválida")}`);
  }
  if (start > end) {
    redirect(
      `/${slug}/admin/autorizaciones?error=${encodeURIComponent("Inicio posterior al fin")}`,
    );
  }

  try {
    await setVacation({ tenantId, userId, start, end });
  } catch (err) {
    redirect(
      `/${slug}/admin/autorizaciones?error=${encodeURIComponent(
        err instanceof Error ? err.message : "ERROR",
      )}`,
    );
  }

  redirect(`/${slug}/admin/autorizaciones?ok=vacaciones_seteadas`);
}

export async function clearVacationAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const userId = (formData.get("userId") ?? "").toString();
  if (!userId) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Falta residente")}`);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true },
  });
  if (!user) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("No encontrado")}`);
  }

  await prisma.user.update({
    where: { id: user!.id },
    data: { vacationStart: null, vacationEnd: null },
  });

  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "user.vacation_cleared",
    entityType: "User",
    entityId: user!.id,
    metadata: {},
  });

  redirect(`/${slug}/admin/autorizaciones?ok=vacaciones_borradas`);
}
