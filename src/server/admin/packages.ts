"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { cancelPackage } from "@/server/packages/cancel";

export async function cancelPackageAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) {
    redirect(`/${slug}/admin/paquetes?error=${encodeURIComponent("Edificio no encontrado")}`);
  }

  const packageId = formData.get("packageId");
  const reason = formData.get("reason");
  if (typeof packageId !== "string" || !packageId) {
    redirect(`/${slug}/admin/paquetes?error=${encodeURIComponent("Falta id de paquete")}`);
  }
  if (typeof reason !== "string" || !reason.trim()) {
    redirect(`/${slug}/admin/paquetes?error=${encodeURIComponent("Falta motivo")}`);
  }

  try {
    await cancelPackage({
      tenantId: tenant!.id,
      packageId,
      reason: reason.trim(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ERROR";
    redirect(`/${slug}/admin/paquetes?error=${encodeURIComponent(msg)}`);
  }

  redirect(`/${slug}/admin/paquetes?ok=cancelado`);
}
