import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateUniquePickupCode } from "@/lib/codes";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";
import { isTenantOperational } from "@/lib/subscription";
import { getWhatsAppClient } from "@/lib/whatsapp/client";
import { isPhotoEphemeral, photoCopyPhone } from "@/lib/photo-policy";
import { getStorageClient } from "@/lib/storage/client";
import { qrImageUrl } from "@/lib/urls";

const RegisterPackageInput = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  carrier: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
  photoUrl: z.string().url().optional(),
});

export type RegisterPackageInput = z.infer<typeof RegisterPackageInput>;

export interface RegisterPackageResult {
  packageId: string;
  pickupCode: string;
  pickupToken: string;
  notifiedPhones: string[];
}

export async function registerPackage(
  raw: RegisterPackageInput,
): Promise<RegisterPackageResult> {
  const input = RegisterPackageInput.parse(raw);
  const session = await requireTenantRole(input.tenantId, ["guard", "admin"]);

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { name: true, settings: true, subscriptionStatus: true, trialEndsAt: true },
  });

  // El gate de suscripción aplica solo al alta de paquetes: los retiros y
  // cancelaciones de pendientes siguen permitidos aunque el tenant esté caído.
  if (!isTenantOperational(tenant)) {
    throw new Error("SUBSCRIPTION_INACTIVE");
  }

  // photoUrl llega como campo del form, así que lo controla el cliente: sin
  // este chequeo un guardia podría pasar cualquier URL y quedaría (a) enviada a
  // los residentes como imagen del mensaje desde el número oficial del
  // edificio, y (b) guardada y renderizada en el panel del admin, filtrándole
  // la visita a un host ajeno. Sólo aceptamos lo que produjo nuestro storage.
  if (input.photoUrl && !getStorageClient().isOwnUrl(input.photoUrl)) {
    throw new Error("INVALID_PHOTO_URL");
  }

  const unit = await prisma.unit.findFirstOrThrow({
    where: { id: input.unitId, tenantId: input.tenantId },
    include: {
      residents: {
        include: { user: { select: { id: true, name: true, phone: true } } },
      },
    },
  });

  // generateUniquePickupCode chequea colisiones antes de insertar, pero dos
  // registros simultáneos pueden elegir el mismo código en esa ventana. El
  // índice único parcial (tenantId, pickupCode) WHERE awaiting_pickup tira
  // P2002 en ese caso; reintentamos con un código nuevo.
  let pkg: Awaited<ReturnType<typeof prisma.package.create>> | null = null;
  let pickupCode = "";
  for (let attempt = 0; attempt < 3 && !pkg; attempt++) {
    pickupCode = await generateUniquePickupCode(input.tenantId);
    try {
      pkg = await prisma.package.create({
        data: {
          tenantId: input.tenantId,
          unitId: input.unitId,
          receivedByUserId: session.userId,
          carrier: input.carrier,
          photoUrl: input.photoUrl,
          notes: input.notes,
          pickupCode,
        },
      });
    } catch (err) {
      const isCodeCollision =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isCodeCollision || attempt === 2) throw err;
    }
  }
  if (!pkg) throw new Error("PICKUP_CODE_EXHAUSTED");

  await recordAudit({
    tenantId: input.tenantId,
    actorUserId: session.userId,
    action: "package.registered",
    entityType: "Package",
    entityId: pkg.id,
    metadata: { unitId: input.unitId, carrier: input.carrier ?? null },
  });

  const notifiedPhones: string[] = [];
  // Sólo borramos la foto del bucket si Meta llegó a llevarse al menos una
  // copia: si todos los envíos fallaron, conservarla permite diagnosticar y
  // reenviar en vez de perder la evidencia del paquete.
  let photoDelivered = false;
  const whatsapp = getWhatsAppClient();
  const storage = getStorageClient();
  const headerImageUrl = qrImageUrl(pkg.pickupToken);

  for (const membership of unit.residents) {
    const resident = membership.user;
    if (!resident.phone) continue;
    try {
      const sent = await whatsapp.sendTemplate({
        to: resident.phone,
        template: "paquete_recibido_v3",
        params: [resident.name, tenant.name, unit.label],
        headerImageUrl,
      });
      await prisma.notification.create({
        data: {
          packageId: pkg.id,
          channel: "whatsapp",
          templateName: "paquete_recibido_v3",
          recipientPhone: resident.phone,
          providerMessageId: sent.providerMessageId,
          status: "sent",
          sentAt: new Date(),
        },
      });
      notifiedPhones.push(resident.phone);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // El fallo se persiste en Notification, pero también va a stdout: sin esto
      // un envío roto es invisible en los logs del server (el alta del paquete
      // devuelve 303 igual) y hay que ir a mirar la tabla para enterarse.
      console.error(
        `[whatsapp] paquete_recibido_v3 falló para ${resident.phone} (package ${pkg.id}): ${message}`,
      );
      await prisma.notification.create({
        data: {
          packageId: pkg.id,
          channel: "whatsapp",
          templateName: "paquete_recibido_v3",
          recipientPhone: resident.phone,
          status: "failed",
          errorPayload: { message },
        },
      });
    }

    // Segundo mensaje con la foto real del paquete (si el guardia la sacó).
    // Independiente del anterior: si el QR falló, la foto puede llegar igual.
    if (input.photoUrl) {
      try {
        const sentPhoto = await whatsapp.sendTemplate({
          to: resident.phone,
          template: "paquete_foto_v1",
          params: [unit.label],
          headerImageUrl: input.photoUrl,
        });
        await prisma.notification.create({
          data: {
            packageId: pkg.id,
            channel: "whatsapp",
            templateName: "paquete_foto_v1",
            recipientPhone: resident.phone,
            providerMessageId: sentPhoto.providerMessageId,
            status: "sent",
            sentAt: new Date(),
          },
        });
        photoDelivered = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[whatsapp] paquete_foto_v1 falló para ${resident.phone} (package ${pkg.id}): ${message}`,
        );
        await prisma.notification.create({
          data: {
            packageId: pkg.id,
            channel: "whatsapp",
            templateName: "paquete_foto_v1",
            recipientPhone: resident.phone,
            status: "failed",
            errorPayload: { message },
          },
        });
      }
    }
  }

  // Copia de la foto a la conserjería: le deja el mismo mensaje en su propio
  // WhatsApp, que es donde el guardia realmente va a buscarla después. No
  // depende del panel ni de que la foto siga en el bucket cuando venza la
  // retención. Independiente de los envíos al residente: si aquellos fallaron,
  // esta copia igual tiene sentido.
  const copyPhone = photoCopyPhone(tenant.settings);
  if (input.photoUrl && copyPhone) {
    try {
      const sentCopy = await whatsapp.sendTemplate({
        to: copyPhone,
        template: "paquete_foto_v1",
        params: [unit.label],
        headerImageUrl: input.photoUrl,
      });
      await prisma.notification.create({
        data: {
          packageId: pkg.id,
          channel: "whatsapp",
          templateName: "paquete_foto_v1",
          recipientPhone: copyPhone,
          providerMessageId: sentCopy.providerMessageId,
          status: "sent",
          sentAt: new Date(),
        },
      });
      photoDelivered = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[whatsapp] copia a conserjería falló para ${copyPhone} (package ${pkg.id}): ${message}`,
      );
      await prisma.notification.create({
        data: {
          packageId: pkg.id,
          channel: "whatsapp",
          templateName: "paquete_foto_v1",
          recipientPhone: copyPhone,
          status: "failed",
          errorPayload: { message },
        },
      });
    }
  }

  // Foto efímera: Meta ya descargó la imagen al armar cada mensaje (un
  // sendTemplate que devuelve message id implica que se la llevó; si no puede
  // bajarla responde error). A partir de acá el archivo permanente es el chat
  // de WhatsApp, no nuestro bucket — así no queda una imagen con nombre y
  // dirección del residente en un bucket de lectura pública.
  if (input.photoUrl && photoDelivered && isPhotoEphemeral(tenant.settings)) {
    try {
      await storage.remove(input.photoUrl);
      await prisma.package.update({
        where: { id: pkg.id },
        data: { photoUrl: null },
      });
    } catch (err) {
      // No es fatal: el cron de retención lo vuelve a intentar más adelante.
      console.error(
        `[storage] no se pudo borrar la foto efímera de ${pkg.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    packageId: pkg.id,
    pickupCode,
    pickupToken: pkg.pickupToken,
    notifiedPhones,
  };
}
