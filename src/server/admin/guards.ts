"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

// Teléfono opcional para guardias (no se usa para auth, sólo contacto interno).
const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/, "Teléfono inválido — usá formato E.164 (+549…)")
  .transform((s) => (s.startsWith("+") ? s : `+${s}`));

// Email es obligatorio: es el único método de login (magic link Auth.js).
const CreateGuardSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  phone: PhoneSchema.optional().or(z.literal("").transform(() => undefined)),
});

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

export async function createGuardAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const parsed = CreateGuardSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/personal?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
      )}`,
    );
  }

  try {
    const user = await prisma.user.create({
      data: {
        tenantId,
        role: "guard",
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
    });

    await recordAudit({
      tenantId,
      actorUserId: session.userId,
      action: "guard.created",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email, phone: user.phone },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.[0] ?? "campo";
      redirect(
        `/${slug}/admin/personal?error=${encodeURIComponent(
          `Ya hay un usuario con ese ${target}`,
        )}`,
      );
    }
    redirect(
      `/${slug}/admin/personal?error=${encodeURIComponent(
        err instanceof Error ? err.message : "ERROR",
      )}`,
    );
  }

  redirect(`/${slug}/admin/personal?ok=creado`);
}

export async function deleteGuardAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    redirect(`/${slug}/admin/personal?error=${encodeURIComponent("Falta id")}`);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId as string, tenantId, role: "guard" },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    redirect(`/${slug}/admin/personal?error=${encodeURIComponent("No encontrado")}`);
  }

  try {
    await prisma.user.delete({ where: { id: user!.id } });
    await recordAudit({
      tenantId,
      actorUserId: session.userId,
      action: "guard.deleted",
      entityType: "User",
      entityId: user!.id,
      metadata: { name: user!.name, email: user!.email },
    });
  } catch (err) {
    // Package.receivedBy / pickedUpBy son FK con onDelete restrict por defecto:
    // si el guardia ya operó paquetes, no se puede borrar (preserva trazabilidad).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      redirect(
        `/${slug}/admin/personal?error=${encodeURIComponent(
          "Este guardia tiene paquetes registrados o entregados. No se puede borrar para no perder la trazabilidad.",
        )}`,
      );
    }
    redirect(
      `/${slug}/admin/personal?error=${encodeURIComponent(
        err instanceof Error ? err.message : "ERROR",
      )}`,
    );
  }

  redirect(`/${slug}/admin/personal?ok=borrado`);
}
