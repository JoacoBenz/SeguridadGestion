"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

const CreateInput = z.object({
  description: z.string().trim().min(3).max(500),
  foundLocation: z.string().trim().max(200).optional(),
});

export async function createLostFoundAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin", "guard"]);
  const parsed = CreateInput.safeParse({
    description: formData.get("description"),
    foundLocation: formData.get("foundLocation") || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/objetos?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Datos inválidos")}`,
    );
  }
  const item = await prisma.lostFoundItem.create({
    data: {
      tenantId,
      description: parsed.data.description,
      foundLocation: parsed.data.foundLocation,
      postedByUserId: session.userId,
      status: "lost",
    },
  });
  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "lost_found.posted",
    entityType: "LostFoundItem",
    entityId: item.id,
    metadata: { description: item.description },
  });
  redirect(`/${slug}/admin/objetos?ok=cargado`);
}

const StatusInput = z.object({
  itemId: z.string().min(1),
  next: z.enum(["claimed", "disposed"]),
});

export async function updateLostFoundStatusAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin", "guard"]);
  const parsed = StatusInput.safeParse({
    itemId: formData.get("itemId"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    redirect(`/${slug}/admin/objetos?error=${encodeURIComponent("Datos inválidos")}`);
  }
  const item = await prisma.lostFoundItem.findFirst({
    where: { id: parsed.data.itemId, tenantId },
  });
  if (!item) redirect(`/${slug}/admin/objetos?error=${encodeURIComponent("No encontrado")}`);
  const updated = await prisma.lostFoundItem.update({
    where: { id: item!.id },
    data: {
      status: parsed.data.next,
      claimedByUserId: parsed.data.next === "claimed" ? session.userId : null,
      claimedAt: parsed.data.next === "claimed" ? new Date() : null,
    },
  });
  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: `lost_found.${parsed.data.next}`,
    entityType: "LostFoundItem",
    entityId: updated.id,
  });
  redirect(`/${slug}/admin/objetos?ok=actualizado`);
}
