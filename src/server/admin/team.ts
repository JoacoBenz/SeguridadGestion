"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { renderWelcomeEmail } from "@/lib/auth/welcome-email";

// Gestión del equipo del edificio: usuarios con rol admin o guard, que entran
// por email (magic link). NO incluye residentes (esos viven en residents.ts)
// ni el guard sintético del dispositivo-PIN.

const TeamRoleSchema = z.enum(["admin", "guard"]);

const CreateMemberSchema = z.object({
  name: z.string().trim().min(1, "Falta el nombre").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: TeamRoleSchema,
});

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

// redirect() nunca retorna (tira NEXT_REDIRECT); tipar como `never` deja que
// TS trate las ramas de error como terminales sin necesitar `return` en cada call.
function back(slug: string, params: string): never {
  redirect(`/${slug}/admin/equipo?${params}`);
}

export async function createMemberAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true },
  });
  const session = await requireTenantRole(tenantId, ["admin"]);

  const parsed = CreateMemberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    back(slug, `error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Datos inválidos")}`);
  }
  const { name, email, role } = parsed.data;

  // Email es globalmente único (requisito de Auth.js). Si ya existe en OTRO
  // edificio, no lo robamos silenciosamente: avisamos.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, tenantId: true },
  });
  if (existing && existing.tenantId && existing.tenantId !== tenantId) {
    back(slug, `error=${encodeURIComponent("Ese email ya pertenece a otro edificio")}`);
  }

  try {
    if (existing) {
      // Usuario sin edificio (o del mismo): lo asignamos/actualizamos.
      await prisma.user.update({
        where: { id: existing.id },
        data: { tenantId, role, name },
      });
    } else {
      await prisma.user.create({
        data: { tenantId, role, name, email },
      });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      back(slug, `error=${encodeURIComponent("Ese email ya está en uso")}`);
    }
    throw err;
  }

  // Igual que al crear un edificio: sin el mail, la persona queda dada de alta
  // y sin enterarse. No puede tumbar la acción — el alta ya está hecha.
  const welcome = renderWelcomeEmail({
    tenantName: tenant.name,
    recipientEmail: email,
    role,
  });
  await sendEmail({ to: email, ...welcome });

  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "team.member_added",
    entityType: "User",
    entityId: email,
    metadata: { role, email },
  });

  back(slug, `ok=${encodeURIComponent(`${role === "admin" ? "Admin" : "Guardia"} agregado`)}`);
}

export async function changeMemberRoleAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const userId = formData.get("userId");
  const parsedRole = TeamRoleSchema.safeParse(formData.get("role"));
  if (typeof userId !== "string" || !parsedRole.success) {
    back(slug, `error=${encodeURIComponent("Datos inválidos")}`);
  }

  // Un admin no puede cambiarse el rol a sí mismo (evita autobloquearse).
  if (userId === session.userId) {
    back(slug, `error=${encodeURIComponent("No podés cambiar tu propio rol")}`);
  }

  const member = await prisma.user.findFirst({
    where: {
      id: userId as string,
      tenantId,
      role: { in: ["admin", "guard"] },
      NOT: { email: { endsWith: "@paqueteok.device" } },
    },
    select: { id: true, email: true },
  });
  if (!member) back(slug, `error=${encodeURIComponent("Usuario no encontrado")}`);

  await prisma.user.update({ where: { id: member!.id }, data: { role: parsedRole.data } });

  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "team.role_changed",
    entityType: "User",
    entityId: member!.id,
    metadata: { to: parsedRole.data, email: member!.email },
  });

  back(slug, `ok=${encodeURIComponent("Rol actualizado")}`);
}

export async function removeMemberAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);

  const userId = formData.get("userId");
  if (typeof userId !== "string") {
    back(slug, `error=${encodeURIComponent("Falta id")}`);
  }
  if (userId === session.userId) {
    back(slug, `error=${encodeURIComponent("No podés eliminarte a vos mismo")}`);
  }

  const member = await prisma.user.findFirst({
    where: {
      id: userId as string,
      tenantId,
      role: { in: ["admin", "guard"] },
      NOT: { email: { endsWith: "@paqueteok.device" } },
    },
    select: { id: true, email: true, role: true },
  });
  if (!member) back(slug, `error=${encodeURIComponent("Usuario no encontrado")}`);

  try {
    await prisma.user.delete({ where: { id: member!.id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      // Tiene paquetes recibidos/entregados: no se puede borrar sin perder
      // historial. Lo desvinculamos del edificio en su lugar.
      await prisma.user.update({ where: { id: member!.id }, data: { tenantId: null } });
      await recordAudit({
        tenantId,
        actorUserId: session.userId,
        action: "team.member_unlinked",
        entityType: "User",
        entityId: member!.id,
        metadata: { email: member!.email, reason: "has_package_history" },
      });
      back(slug, `ok=${encodeURIComponent("Miembro desvinculado (tenía historial de paquetes)")}`);
    }
    throw err;
  }

  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "team.member_removed",
    entityType: "User",
    entityId: member!.id,
    metadata: { email: member!.email, role: member!.role },
  });

  back(slug, `ok=${encodeURIComponent("Miembro eliminado")}`);
}
