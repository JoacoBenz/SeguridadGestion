"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { parseDaysOfWeek, parseTimeRange } from "@/lib/recurring/parse";

// HH:MM 24h
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const CreateInput = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  createdByUserId: z.string().min(1),
  name: z.string().trim().min(1, "Falta el nombre").max(80),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, "Falta al menos un día"),
  startTime: z.string().regex(TIME_RE, "Hora inválida"),
  endTime: z.string().regex(TIME_RE, "Hora inválida"),
  validUntil: z.date().optional(),
}).refine((v) => v.startTime < v.endTime, {
  message: "El inicio tiene que ser anterior al fin",
  path: ["endTime"],
});

export type CreateRecurringAuthInput = z.infer<typeof CreateInput>;

// Llamable desde el dispatcher del chat (input tipado) o desde el wrapper admin.
export async function createRecurringAuthorization(
  raw: CreateRecurringAuthInput,
): Promise<{ id: string }> {
  const input = CreateInput.parse(raw);
  await requireTenantRole(input.tenantId, ["admin", "resident"]);

  // Confirma que la unidad existe en el tenant.
  const unit = await prisma.unit.findFirst({
    where: { id: input.unitId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!unit) throw new Error("UNIT_NOT_FOUND");

  const created = await prisma.recurringAuthorization.create({
    data: {
      tenantId: input.tenantId,
      unitId: input.unitId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      daysOfWeek: input.daysOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      validUntil: input.validUntil,
    },
  });

  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: input.createdByUserId,
    action: "recurring_auth.created",
    entityType: "RecurringAuthorization",
    entityId: created.id,
    metadata: {
      unitId: input.unitId,
      name: input.name,
      daysOfWeek: input.daysOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });

  return { id: created.id };
}

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

// Form admin: name, unitId, daysOfWeek freeform ("lunes a viernes"), timeRange
// freeform ("08:00-12:00"), validUntil opcional.
export async function createRecurringAuthAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const name = (formData.get("name") ?? "").toString().trim();
  const unitId = (formData.get("unitId") ?? "").toString();
  const daysRaw = (formData.get("daysOfWeek") ?? "").toString();
  const timeRaw = (formData.get("timeRange") ?? "").toString();
  const validUntilRaw = (formData.get("validUntil") ?? "").toString().trim();

  if (!name) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Falta el nombre")}`);
  }
  if (!unitId) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Elegí un depto")}`);
  }

  const days = parseDaysOfWeek(daysRaw);
  if (!days.ok) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent(days.error)}`);
  }
  const time = parseTimeRange(timeRaw);
  if (!time.ok) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent(time.error)}`);
  }

  let validUntil: Date | undefined;
  if (validUntilRaw) {
    const d = new Date(validUntilRaw);
    if (Number.isNaN(d.getTime())) {
      redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Fecha inválida")}`);
    }
    validUntil = d;
  }

  try {
    await createRecurringAuthorization({
      tenantId,
      unitId,
      createdByUserId: session.userId,
      name,
      daysOfWeek: (days as { ok: true; value: number[] }).value,
      startTime: (time as { ok: true; value: { start: string; end: string } }).value.start,
      endTime: (time as { ok: true; value: { start: string; end: string } }).value.end,
      validUntil,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      redirect(
        `/${slug}/admin/autorizaciones?error=${encodeURIComponent("Depto inválido")}`,
      );
    }
    redirect(
      `/${slug}/admin/autorizaciones?error=${encodeURIComponent(
        err instanceof Error ? err.message : "ERROR",
      )}`,
    );
  }

  redirect(`/${slug}/admin/autorizaciones?ok=creada`);
}

async function updateStatus(
  slug: string,
  formData: FormData,
  target: "paused" | "active" | "revoked",
  okKey: "pausada" | "reanudada" | "revocada",
  auditAction: string,
) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const id = formData.get("id");
  if (typeof id !== "string") {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("Falta id")}`);
  }

  const existing = await prisma.recurringAuthorization.findFirst({
    where: { id: id as string, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) {
    redirect(`/${slug}/admin/autorizaciones?error=${encodeURIComponent("No encontrada")}`);
  }

  await prisma.recurringAuthorization.update({
    where: { id: existing!.id },
    data: { status: target },
  });

  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: auditAction,
    entityType: "RecurringAuthorization",
    entityId: existing!.id,
    metadata: { from: existing!.status, to: target },
  });

  redirect(`/${slug}/admin/autorizaciones?ok=${okKey}`);
}

export async function pauseRecurringAuthAction(slug: string, formData: FormData) {
  await updateStatus(slug, formData, "paused", "pausada", "recurring_auth.paused");
}

export async function resumeRecurringAuthAction(slug: string, formData: FormData) {
  await updateStatus(slug, formData, "active", "reanudada", "recurring_auth.resumed");
}

export async function revokeRecurringAuthAction(slug: string, formData: FormData) {
  await updateStatus(slug, formData, "revoked", "revocada", "recurring_auth.revoked");
}
