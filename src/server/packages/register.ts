import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateUniquePickupCode } from "@/lib/codes";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";
import { isTenantOperational } from "@/lib/subscription";
import { getWhatsAppClient } from "@/lib/whatsapp/client";
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
    select: { name: true, subscriptionStatus: true, trialEndsAt: true },
  });

  // El gate de suscripción aplica solo al alta de paquetes: los retiros y
  // cancelaciones de pendientes siguen permitidos aunque el tenant esté caído.
  if (!isTenantOperational(tenant)) {
    throw new Error("SUBSCRIPTION_INACTIVE");
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
  const whatsapp = getWhatsAppClient();
  const headerImageUrl = qrImageUrl(pkg.pickupToken);

  for (const membership of unit.residents) {
    const resident = membership.user;
    if (!resident.phone) continue;
    try {
      const sent = await whatsapp.sendTemplate({
        to: resident.phone,
        template: "paquete_recibido_v2",
        params: [resident.name, tenant.name, unit.label, pickupCode],
        headerImageUrl,
      });
      await prisma.notification.create({
        data: {
          packageId: pkg.id,
          channel: "whatsapp",
          templateName: "paquete_recibido_v2",
          recipientPhone: resident.phone,
          providerMessageId: sent.providerMessageId,
          status: "sent",
          sentAt: new Date(),
        },
      });
      notifiedPhones.push(resident.phone);
    } catch (err) {
      await prisma.notification.create({
        data: {
          packageId: pkg.id,
          channel: "whatsapp",
          templateName: "paquete_recibido_v2",
          recipientPhone: resident.phone,
          status: "failed",
          errorPayload: { message: err instanceof Error ? err.message : String(err) },
        },
      });
    }
  }

  return {
    packageId: pkg.id,
    pickupCode,
    pickupToken: pkg.pickupToken,
    notifiedPhones,
  };
}
