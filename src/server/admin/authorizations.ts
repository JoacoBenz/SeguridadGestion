"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createRecurringAuthorization } from "@/server/access/announce-recurring";
import {
  pauseRecurringAuthorization,
  revokeRecurringAuthorization,
} from "@/server/access/pause-recurring";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const CreateInput = z.object({
  unitId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  daysOfWeek: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    )
    .refine((arr) => arr.length > 0, "Elegí al menos un día"),
  startTime: z.string().regex(HHMM, "Hora inválida"),
  endTime: z.string().regex(HHMM, "Hora inválida"),
});

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

export async function createRecurringAuthAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const parsed = CreateInput.safeParse({
    unitId: formData.get("unitId"),
    name: formData.get("name"),
    daysOfWeek: formData.get("daysOfWeek") ?? "",
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/autorizaciones?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Datos inválidos")}`,
    );
  }

  try {
    await createRecurringAuthorization({
      tenantId,
      unitId: parsed.data.unitId,
      createdByUserId: session.userId,
      name: parsed.data.name,
      daysOfWeek: parsed.data.daysOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
    });
  } catch (err) {
    redirect(
      `/${slug}/admin/autorizaciones?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }
  redirect(`/${slug}/admin/autorizaciones?ok=creada`);
}

export async function pauseRecurringAuthAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  await requireTenantRole(tenantId, ["admin"]);
  const id = formData.get("authorizationId");
  if (typeof id !== "string" || !id) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Falta id")}`);
  }
  await pauseRecurringAuthorization({ tenantId, authorizationId: id });
  redirect(`/${slug}/admin/autorizaciones?ok=pausada`);
}

export async function revokeRecurringAuthAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  await requireTenantRole(tenantId, ["admin"]);
  const id = formData.get("authorizationId");
  if (typeof id !== "string" || !id) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Falta id")}`);
  }
  await revokeRecurringAuthorization({ tenantId, authorizationId: id });
  redirect(`/${slug}/admin/autorizaciones?ok=revocada`);
}

const VacationInput = z.object({
  userId: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
});

export async function setUserVacationAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);
  const parsed = VacationInput.safeParse({
    userId: formData.get("userId"),
    start: formData.get("start"),
    end: formData.get("end"),
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/autorizaciones?error=${encodeURIComponent("Datos inválidos")}`,
    );
  }
  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Fechas inválidas")}`);
  }
  const user = await prisma.user.findFirst({
    where: { id: parsed.data.userId, tenantId },
  });
  if (!user) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Usuario no encontrado")}`);
  }
  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { vacationStart: start, vacationEnd: end },
  });
  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "user.vacation_set",
    entityType: "User",
    entityId: parsed.data.userId,
    metadata: { start: start.toISOString(), end: end.toISOString() },
  });
  redirect(`/${slug}/admin/autorizaciones?ok=vacaciones`);
}

export async function clearUserVacationAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Falta id")}`);
  }
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Usuario no encontrado")}`);
  await prisma.user.update({
    where: { id: userId },
    data: { vacationStart: null, vacationEnd: null },
  });
  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "user.vacation_cleared",
    entityType: "User",
    entityId: userId,
  });
  redirect(`/${slug}/admin/autorizaciones?ok=sin-vacaciones`);
}
