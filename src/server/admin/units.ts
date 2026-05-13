"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const CreateUnitSchema = z.object({
  label: z.string().trim().min(1, "Falta el label").max(20, "Demasiado largo"),
  notes: z.string().trim().max(200).optional(),
});

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

export async function createUnitAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const parsed = CreateUnitSchema.safeParse({
    label: formData.get("label"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/unidades?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
      )}`,
    );
  }

  try {
    const unit = await prisma.unit.create({
      data: { tenantId, label: parsed.data.label, notes: parsed.data.notes },
    });
    await recordAudit({
      tenantId,
      actorUserId: session.userId,
      action: "unit.created",
      entityType: "Unit",
      entityId: unit.id,
      metadata: { label: unit.label },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      redirect(
        `/${slug}/admin/unidades?error=${encodeURIComponent("Ya existe una unidad con ese label")}`,
      );
    }
    redirect(
      `/${slug}/admin/unidades?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }

  redirect(`/${slug}/admin/unidades?ok=creada`);
}

export async function deleteUnitAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const unitId = formData.get("unitId");
  if (typeof unitId !== "string") {
    redirect(`/${slug}/admin/unidades?error=${encodeURIComponent("Falta id")}`);
  }

  // Verifica pertenencia al tenant antes de borrar.
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, tenantId },
    select: { id: true, label: true },
  });
  if (!unit) redirect(`/${slug}/admin/unidades?error=${encodeURIComponent("No encontrada")}`);

  try {
    await prisma.unit.delete({ where: { id: unit!.id } });
    await recordAudit({
      tenantId,
      actorUserId: session.userId,
      action: "unit.deleted",
      entityType: "Unit",
      entityId: unit!.id,
      metadata: { label: unit!.label },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      redirect(
        `/${slug}/admin/unidades?error=${encodeURIComponent(
          "La unidad tiene paquetes o residentes asociados. Cancelá o reasignalos primero.",
        )}`,
      );
    }
    redirect(
      `/${slug}/admin/unidades?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }

  redirect(`/${slug}/admin/unidades?ok=borrada`);
}
