"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { PHOTO_MODES, type PhotoMode } from "@/lib/photo-policy";

// El edificio elige si pide foto. Cuánto se conservan NO está acá a propósito:
// es una regla del sistema (PHOTO_RETENTION_DAYS), no una preferencia por
// edificio. La copia al WhatsApp del mostrador (settings.seguridadPhone,
// photoCopyPhone en photo-policy) quedó oculta: el envío sigue implementado,
// pero ningún admin puede configurar el número desde la UI.
const PhotoSettingsSchema = z.object({
  photoMode: z.enum(PHOTO_MODES as unknown as [PhotoMode, ...PhotoMode[]]),
});

export async function setPhotoSettingsAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  const session = await requireTenantRole(tenant.id, ["admin"]);

  const parsed = PhotoSettingsSchema.safeParse({
    photoMode: formData.get("photoMode"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Configuración de fotos inválida";
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
        photoMode: parsed.data.photoMode,
      } as Prisma.InputJsonValue,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorUserId: session.userId,
    action: "tenant.photo_settings_updated",
    entityType: "Tenant",
    entityId: tenant.id,
    metadata: {
      photoMode: parsed.data.photoMode,
    },
  });

  redirect(`/${slug}/admin?ok=${encodeURIComponent("Configuración de fotos actualizada")}`);
}
