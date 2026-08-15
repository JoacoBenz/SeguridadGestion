import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";
import { isValidPickupCode } from "@/lib/codes";
import { getWhatsAppClient } from "@/lib/whatsapp/client";
import { formatDate, formatTime } from "@/lib/datetime";
import { getStorageClient } from "@/lib/storage/client";

const PickupInput = z
  .object({
    tenantId: z.string().min(1),
    pickupCode: z.string().optional(),
    pickupToken: z.string().optional(),
    pickupPhotoUrl: z.string().url().optional(),
  })
  .refine((v) => v.pickupCode || v.pickupToken, {
    message: "Hay que enviar pickupCode o pickupToken",
  });

export type PickupInput = z.infer<typeof PickupInput>;

export interface PickupResult {
  packageId: string;
  unitLabel: string;
  pickedUpAt: Date;
  /** URL firmada efímera de la foto del INGRESO, para que el guardia sepa qué
   *  paquete agarrar del depósito. null si el paquete no tiene foto. */
  photoUrl: string | null;
  carrier: string | null;
}

export async function pickupPackage(raw: PickupInput): Promise<PickupResult> {
  const input = PickupInput.parse(raw);
  const session = await requireTenantRole(input.tenantId, ["guard", "admin"]);

  if (input.pickupCode && !isValidPickupCode(input.pickupCode)) {
    throw new Error("INVALID_CODE");
  }

  // Igual que en register: el campo lo controla el cliente, así que sólo
  // aceptamos URLs que haya producido nuestro propio storage.
  if (input.pickupPhotoUrl && !getStorageClient().isOwnUrl(input.pickupPhotoUrl)) {
    throw new Error("INVALID_PHOTO_URL");
  }

  const pkg = await prisma.package.findFirst({
    where: {
      tenantId: input.tenantId,
      status: "awaiting_pickup",
      ...(input.pickupToken
        ? { pickupToken: input.pickupToken }
        : { pickupCode: input.pickupCode }),
    },
    include: {
      tenant: { select: { timezone: true } },
      unit: {
        include: {
          residents: { include: { user: { select: { phone: true, name: true } } } },
        },
      },
    },
  });

  if (!pkg) throw new Error("PACKAGE_NOT_FOUND");
  const tz = pkg.tenant.timezone;

  const now = new Date();
  // Conditional update: two guards scanning the same package at once must not
  // both succeed. Only the request that flips awaiting_pickup → picked_up wins.
  const updated = await prisma.package.updateMany({
    where: { id: pkg.id, status: "awaiting_pickup" },
    data: {
      status: "picked_up",
      pickedUpAt: now,
      pickedUpByUserId: session.userId,
      pickupPhotoUrl: input.pickupPhotoUrl,
    },
  });
  if (updated.count === 0) throw new Error("PACKAGE_NOT_FOUND");

  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "package.picked_up",
    entityType: "Package",
    entityId: pkg.id,
    metadata: {
      via: input.pickupToken ? "qr" : "code",
      withPhoto: Boolean(input.pickupPhotoUrl),
    },
  });

  const whatsapp = getWhatsAppClient();
  for (const membership of pkg.unit.residents) {
    const phone = membership.user.phone;
    if (!phone) continue;
    try {
      const sent = await whatsapp.sendTemplate({
        to: phone,
        template: "paquete_retirado_v1",
        params: [formatDate(pkg.receivedAt, tz), formatTime(now, tz)],
      });
      await prisma.notification.create({
        data: {
          packageId: pkg.id,
          channel: "whatsapp",
          templateName: "paquete_retirado_v1",
          recipientPhone: phone,
          providerMessageId: sent.providerMessageId,
          status: "sent",
          sentAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[whatsapp] paquete_retirado_v1 falló para ${phone} (package ${pkg.id}): ${message}`,
      );
      await prisma.notification.create({
        data: {
          packageId: pkg.id,
          channel: "whatsapp",
          templateName: "paquete_retirado_v1",
          recipientPhone: phone,
          status: "failed",
          errorPayload: { message },
        },
      });
    }
  }

  // La foto del ingreso, firmada al vuelo (15 min alcanza para el mostrador):
  // el guardia la ve en el popup de éxito y sabe cuál agarrar del depósito.
  // El startsWith filtra las dev-storage:// del cliente sin bucket.
  const photoUrl =
    pkg.photoUrl && pkg.photoUrl.startsWith("http")
      ? await getStorageClient().signedUrl(pkg.photoUrl, 15 * 60)
      : null;

  return {
    packageId: pkg.id,
    unitLabel: pkg.unit.label,
    pickedUpAt: now,
    photoUrl,
    carrier: pkg.carrier ?? null,
  };
}
