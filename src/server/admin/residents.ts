"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

// Teléfono en E.164 (con el +) o vacío. WhatsApp espera ese formato.
const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/, "Teléfono inválido — usá formato E.164 (+549…)")
  .transform((s) => (s.startsWith("+") ? s : `+${s}`));

const CreateResidentSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre").max(80),
  phone: PhoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  unitId: z.string().min(1, "Elegí un departamento"),
});

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

export async function createResidentAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const parsed = CreateResidentSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    unitId: formData.get("unitId"),
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/residentes?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
      )}`,
    );
  }

  // La unidad tiene que ser del mismo tenant.
  const unit = await prisma.unit.findFirst({
    where: { id: parsed.data.unitId, tenantId },
    select: { id: true, label: true },
  });
  if (!unit) {
    redirect(`/${slug}/admin/residentes?error=${encodeURIComponent("Unidad inválida")}`);
  }

  try {
    const user = await prisma.user.create({
      data: {
        tenantId,
        role: "resident",
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
      },
    });

    await prisma.unitResident.create({
      data: { unitId: unit!.id, userId: user.id, isPrimary: true },
    });

    await recordAudit({
      tenantId,
      actorUserId: session.userId,
      action: "resident.created",
      entityType: "User",
      entityId: user.id,
      metadata: { unitId: unit!.id, unitLabel: unit!.label, phone: user.phone },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.[0] ?? "campo";
      redirect(
        `/${slug}/admin/residentes?error=${encodeURIComponent(
          `Ya hay un usuario con ese ${target}`,
        )}`,
      );
    }
    redirect(
      `/${slug}/admin/residentes?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }

  redirect(`/${slug}/admin/residentes?ok=creado`);
}

export async function removeFromUnitAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const userId = formData.get("userId");
  const unitId = formData.get("unitId");
  if (typeof userId !== "string" || typeof unitId !== "string") {
    redirect(`/${slug}/admin/residentes?error=${encodeURIComponent("Faltan ids")}`);
  }

  // Confirma que ambos lados pertenecen al tenant.
  const [user, unit] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } }),
    prisma.unit.findFirst({ where: { id: unitId, tenantId }, select: { id: true } }),
  ]);
  if (!user || !unit) {
    redirect(`/${slug}/admin/residentes?error=${encodeURIComponent("No encontrado")}`);
  }

  await prisma.unitResident.delete({
    where: { unitId_userId: { unitId: unit!.id, userId: user!.id } },
  });

  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "resident.removed_from_unit",
    entityType: "UnitResident",
    entityId: `${unit!.id}:${user!.id}`,
    metadata: {},
  });

  redirect(`/${slug}/admin/residentes?ok=desvinculado`);
}

export async function deleteResidentAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    redirect(`/${slug}/admin/residentes?error=${encodeURIComponent("Falta id")}`);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: "resident" },
    select: { id: true, name: true, phone: true },
  });
  if (!user) {
    redirect(`/${slug}/admin/residentes?error=${encodeURIComponent("No encontrado")}`);
  }

  try {
    await prisma.user.delete({ where: { id: user!.id } });
    await recordAudit({
      tenantId,
      actorUserId: session.userId,
      action: "resident.deleted",
      entityType: "User",
      entityId: user!.id,
      metadata: { name: user!.name, phone: user!.phone },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      redirect(
        `/${slug}/admin/residentes?error=${encodeURIComponent(
          "El residente tiene paquetes históricos asociados. Usá 'Desvincular' del depto en su lugar.",
        )}`,
      );
    }
    redirect(
      `/${slug}/admin/residentes?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }

  redirect(`/${slug}/admin/residentes?ok=borrado`);
}
