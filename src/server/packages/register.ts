import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateUniquePickupCode } from "@/lib/codes";
import { recordAudit } from "@/lib/audit";
import { requireTenantRole } from "@/lib/auth";
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
    select: { name: true },
  });

  const unit = await prisma.unit.findFirstOrThrow({
    where: { id: input.unitId, tenantId: input.tenantId },
    include: {
      residents: {
        include: { user: { select: { id: true, name: true, phone: true } } },
      },
    },
  });

  const pickupCode = await generateUniquePickupCode(input.tenantId);

  const pkg = await prisma.package.create({
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
