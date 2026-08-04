"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";

// Lo único configurable por edificio sobre las fotos es a qué teléfono del
// mostrador mandarles copia — es un dato que sólo conoce el administrador. Que
// se pida la foto, y que se borre a los 30 días, son reglas del sistema
// (src/lib/photo-policy.ts), no opciones.
const ConserjeriaPhoneSchema = z.string().transform((raw, ctx) => {
  if (!raw.trim()) return "";
  const result = normalizePhone(raw);
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    return z.NEVER;
  }
  return result.phone;
});

export async function setPhotoSettingsAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  const session = await requireTenantRole(tenant.id, ["admin"]);

  const parsed = ConserjeriaPhoneSchema.safeParse(formData.get("conserjeriaPhone") ?? "");
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Teléfono inválido";
    redirect(`/${slug}/admin?error=${encodeURIComponent(msg)}`);
  }

  const current = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenant.id },
    select: { settings: true },
  });
  const settings = (current.settings as Record<string, unknown>) ?? {};

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: {
        ...settings,
        conserjeriaPhone: parsed.data,
      } as Prisma.InputJsonValue,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorUserId: session.userId,
    action: "tenant.photo_settings_updated",
    entityType: "Tenant",
    entityId: tenant.id,
    // El número no va al audit: es un dato personal y el log lo lee cualquier
    // admin. Alcanza con saber si quedó configurado o no.
    metadata: { copyToConserjeria: Boolean(parsed.data) },
  });

  redirect(
    `/${slug}/admin?ok=${encodeURIComponent("Teléfono de conserjería actualizado")}`,
  );
}
