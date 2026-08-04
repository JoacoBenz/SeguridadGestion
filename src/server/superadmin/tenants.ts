"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { newTrialEnd } from "@/lib/subscription";
import { sendEmail } from "@/lib/email";
import { renderWelcomeEmail } from "@/lib/auth/welcome-email";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

const CreateTenantSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Slug muy corto")
    .max(40, "Slug muy largo")
    .regex(SLUG, "Solo a-z, 0-9 y guión"),
  name: z.string().trim().min(2, "Falta el nombre").max(120),
  adminEmail: z.string().trim().toLowerCase().email("Email inválido"),
  adminName: z.string().trim().min(1, "Falta el nombre").max(80),
});

async function requireSuperadmin(): Promise<{ userId: string }> {
  const session = await requireSession();
  if (session.role !== "superadmin") throw new Error("FORBIDDEN_ROLE");
  return { userId: session.userId };
}

export async function createTenantAction(formData: FormData) {
  const { userId } = await requireSuperadmin();

  const parsed = CreateTenantSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    adminEmail: formData.get("adminEmail"),
    adminName: formData.get("adminName"),
  });
  if (!parsed.success) {
    redirect(
      `/superadmin/tenants/new?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
      )}`,
    );
  }

  let tenantId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: parsed.data.slug,
          name: parsed.data.name,
          // Todo edificio nuevo arranca en prueba de 14 días.
          subscriptionStatus: "trial",
          trialEndsAt: newTrialEnd(),
        },
      });

      // Si el email ya existe en otro tenant, lo vinculamos a este como admin.
      // (Auth.js exige email globalmente único; ese usuario podría existir en
      // tenantId=null o asignado a otro edificio. Reasignar es decisión explícita.)
      await tx.user.upsert({
        where: { email: parsed.data.adminEmail },
        update: { tenantId: tenant.id, role: "admin", name: parsed.data.adminName },
        create: {
          tenantId: tenant.id,
          role: "admin",
          name: parsed.data.adminName,
          email: parsed.data.adminEmail,
        },
      });

      return tenant;
    });
    tenantId = result.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.[0] ?? "valor";
      redirect(
        `/superadmin/tenants/new?error=${encodeURIComponent(`Ya existe un tenant con ese ${target}`)}`,
      );
    }
    redirect(
      `/superadmin/tenants/new?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }

  // Sin esto el admin queda creado y sin enterarse: alguien tiene que avisarle
  // a mano. El envío va después del audit y no puede tumbar la acción — el
  // edificio ya existe aunque Resend esté caído.
  const welcome = renderWelcomeEmail({
    tenantName: parsed.data.name,
    recipientEmail: parsed.data.adminEmail,
    role: "admin",
  });
  await sendEmail({ to: parsed.data.adminEmail, ...welcome });

  await recordAudit({
    tenantId,
    actorUserId: userId,
    action: "tenant.created",
    entityType: "Tenant",
    entityId: tenantId,
    metadata: { slug: parsed.data.slug, adminEmail: parsed.data.adminEmail },
  });

  redirect(`/superadmin?ok=${encodeURIComponent(parsed.data.slug)}`);
}

const SubscriptionActionSchema = z.enum(["activate", "suspend", "extend_trial"]);

export async function setTenantSubscriptionAction(formData: FormData) {
  const { userId } = await requireSuperadmin();

  const tenantId = formData.get("tenantId");
  const parsedAction = SubscriptionActionSchema.safeParse(formData.get("subAction"));
  if (typeof tenantId !== "string" || !tenantId || !parsedAction.success) {
    redirect(`/superadmin?error=${encodeURIComponent("Acción inválida")}`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!tenant) {
    redirect(`/superadmin?error=${encodeURIComponent("Edificio no encontrado")}`);
  }

  const action = parsedAction.data;
  const data =
    action === "activate"
      ? { subscriptionStatus: "active" as const, trialEndsAt: null }
      : action === "suspend"
        ? { subscriptionStatus: "suspended" as const }
        : { subscriptionStatus: "trial" as const, trialEndsAt: newTrialEnd() };

  await prisma.tenant.update({ where: { id: tenant!.id }, data });

  await recordAudit({
    tenantId: tenant!.id,
    actorUserId: userId,
    action: "tenant.subscription_updated",
    entityType: "Tenant",
    entityId: tenant!.id,
    metadata: {
      subAction: action,
      from: tenant!.subscriptionStatus,
      to: data.subscriptionStatus,
    },
  });

  redirect(`/superadmin?subok=${encodeURIComponent(tenant!.slug)}`);
}
