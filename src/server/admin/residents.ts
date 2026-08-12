"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import { parseResidentsCsv } from "./import-parse";

// El teléfono se normaliza a E.164 acá, en el borde: si entra mal, el envío
// falla recién al registrar un paquete y el error queda enterrado en una
// Notification. normalizePhone acepta las formas habituales (con 0, con 15,
// con espacios) y rechaza con un mensaje concreto lo que no puede resolver.
const PhoneSchema = z.string().transform((raw, ctx) => {
  const result = normalizePhone(raw);
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    return z.NEVER;
  }
  return result.phone;
});

// P2002 con el índice compuesto (tenantId, phone) trae target=["tenantId","phone"];
// al admin le importa el campo que chocó, no el índice. El teléfono choca por
// edificio (en otro edificio el mismo número es válido); el email es global
// porque es la identidad de login de Auth.js.
function duplicateMessage(err: Prisma.PrismaClientKnownRequestError): string {
  const target = (err.meta?.target as string[] | undefined) ?? [];
  if (target.includes("phone")) return "Ya hay un residente con ese teléfono en este edificio";
  if (target.includes("email"))
    return "Ese email ya está usado por un usuario del sistema (el email es único entre todos los edificios; podés dejarlo vacío)";
  return "Ya hay un usuario con esos datos";
}

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
      redirect(
        `/${slug}/admin/residentes?error=${encodeURIComponent(duplicateMessage(err))}`,
      );
    }
    redirect(
      `/${slug}/admin/residentes?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }

  redirect(`/${slug}/admin/residentes?ok=creado`);
}

const UpdateResidentSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1, "Falta el nombre").max(80),
  phone: PhoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  unitId: z
    .string()
    .optional()
    .transform((s) => (s ? s : undefined)),
});

export async function updateResidentAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const parsed = UpdateResidentSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    unitId: formData.get("unitId") || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/residentes?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
      )}`,
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: parsed.data.userId, tenantId, role: "resident" },
    select: { id: true },
  });
  if (!user) {
    redirect(`/${slug}/admin/residentes?error=${encodeURIComponent("No encontrado")}`);
  }

  try {
    await prisma.user.update({
      where: { id: user!.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email ?? null,
      },
    });

    if (parsed.data.unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: parsed.data.unitId, tenantId },
        select: { id: true },
      });
      if (!unit) throw new Error("Unidad inválida");
      await prisma.unitResident.upsert({
        where: { unitId_userId: { unitId: unit.id, userId: user!.id } },
        update: {},
        create: { unitId: unit.id, userId: user!.id },
      });
    }

    await recordAudit({
      tenantId,
      actorUserId: session.userId,
      action: "resident.updated",
      entityType: "User",
      entityId: user!.id,
      metadata: { name: parsed.data.name, phone: parsed.data.phone },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      redirect(
        `/${slug}/admin/residentes?error=${encodeURIComponent(duplicateMessage(err))}`,
      );
    }
    redirect(
      `/${slug}/admin/residentes?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }

  redirect(`/${slug}/admin/residentes?ok=actualizado`);
}

// Import masivo de residentes desde CSV. Crea unidades que no existan (por label)
// y residentes vinculados. Si el parser encuentra CUALQUIER error de formato,
// aborta sin escribir nada y devuelve al preview. Los residentes cuyo teléfono ya
// existe en ESTE edificio (o cuyo email ya existe en el sistema) se saltean, sin
// romper el resto del import. El mismo teléfono en otro edificio es válido.
export async function importResidentsAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const csv = formData.get("csv");
  if (typeof csv !== "string" || !csv.trim()) {
    redirect(`/${slug}/admin/importar?error=${encodeURIComponent("Pegá algún dato primero")}`);
  }

  const parsed = parseResidentsCsv(csv as string);
  if (parsed.rows.length === 0) {
    redirect(`/${slug}/admin/importar?error=${encodeURIComponent("No se encontraron filas")}`);
  }
  if (parsed.errorCount > 0) {
    // No escribimos nada si hay errores — el usuario los corrige y reintenta.
    redirect(
      `/${slug}/admin/importar?error=${encodeURIComponent(
        `${parsed.errorCount} fila(s) con error. Corregilas y reintentá.`,
      )}`,
    );
  }

  let created = 0;
  let skipped = 0;
  const unitCache = new Map<string, string>();

  for (const row of parsed.rows) {
    // Unidad: upsert por (tenantId, label).
    let unitId = unitCache.get(row.unit);
    if (!unitId) {
      const unit = await prisma.unit.upsert({
        where: { tenantId_label: { tenantId, label: row.unit } },
        update: {},
        create: { tenantId, label: row.unit },
        select: { id: true },
      });
      unitId = unit.id;
      unitCache.set(row.unit, unitId);
    }

    try {
      const user = await prisma.user.create({
        data: {
          tenantId,
          role: "resident",
          name: row.name,
          phone: row.phone,
          email: row.email,
        },
      });
      await prisma.unitResident.create({
        data: { unitId, userId: user.id, isPrimary: true },
      });
      created++;
    } catch (err) {
      // Teléfono/email duplicado -> saltear esa fila, seguir con las demás.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        skipped++;
        continue;
      }
      throw err;
    }
  }

  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "residents.imported",
    entityType: "Tenant",
    entityId: tenantId,
    metadata: { created, skipped, total: parsed.rows.length },
  });

  // El detalle importa: "salteados" son teléfonos o emails ya cargados, y sin
  // decirlo el admin no entiende por qué importó 168 y ve 160.
  const detalle =
    skipped === 0
      ? `Se importaron ${created} residente${created === 1 ? "" : "s"}.`
      : `Se importaron ${created} residente${created === 1 ? "" : "s"}. Se saltearon ${skipped} por teléfono o email repetido.`;
  redirect(`/${slug}/admin/residentes?ok=${encodeURIComponent(detalle)}`);
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
