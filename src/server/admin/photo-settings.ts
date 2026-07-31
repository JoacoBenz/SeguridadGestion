"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { PHOTO_MODES, type PhotoMode } from "@/lib/photo-policy";
import { normalizePhone } from "@/lib/phone";

const PhotoSettingsSchema = z.object({
  photoMode: z.enum(PHOTO_MODES as unknown as [PhotoMode, ...PhotoMode[]]),
  // 0 = conservar para siempre. El tope alto es un guard contra un typo
  // (escribir 3650 en vez de 365 es recuperable; 36500 no aporta nada).
  photoRetentionDays: z.coerce.number().int().min(0).max(3650),
  // Vacío = no mandar copia. Si viene algo, se normaliza igual que el teléfono
  // de un residente: un número mal cargado acá falla en silencio al enviar.
  conserjeriaPhone: z.string().transform((raw, ctx) => {
    if (!raw.trim()) return "";
    const result = normalizePhone(raw);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
      return z.NEVER;
    }
    return result.phone;
  }),
});

export async function setPhotoSettingsAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  const session = await requireTenantRole(tenant.id, ["admin"]);

  const parsed = PhotoSettingsSchema.safeParse({
    photoMode: formData.get("photoMode"),
    photoRetentionDays: formData.get("photoRetentionDays"),
    conserjeriaPhone: formData.get("conserjeriaPhone") ?? "",
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
        photoRetentionDays: parsed.data.photoRetentionDays,
        conserjeriaPhone: parsed.data.conserjeriaPhone,
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
      photoRetentionDays: parsed.data.photoRetentionDays,
      // El número no va al audit: es un dato personal y el log lo lee cualquier
      // admin. Alcanza con saber si quedó configurado o no.
      copyToConserjeria: Boolean(parsed.data.conserjeriaPhone),
    },
  });

  redirect(`/${slug}/admin?ok=${encodeURIComponent("Configuración de fotos actualizada")}`);
}
