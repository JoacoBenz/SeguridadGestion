"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { pickupPackage } from "@/server/packages/pickup";
import { extractPickupToken } from "@/server/packages/pickup-token";

export async function pickupByCodeAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) redirect(`/${slug}/conserjeria/retiro?error=Edificio+no+encontrado`);

  const raw = formData.get("pickupCode");
  if (typeof raw !== "string" || !raw.trim()) {
    redirect(`/${slug}/conserjeria/retiro?error=${encodeURIComponent("Ingresá un código")}`);
  }

  // The success redirect must live OUTSIDE the try: redirect() throws
  // NEXT_REDIRECT, and a catch-all would convert success into ?error=NEXT_REDIRECT.
  let unitLabel: string;
  try {
    const result = await pickupPackage({
      tenantId: tenant.id,
      pickupCode: raw.trim().toUpperCase(),
    });
    unitLabel = result.unitLabel;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ERROR";
    redirect(`/${slug}/conserjeria/retiro?error=${encodeURIComponent(msg)}`);
  }

  redirect(`/${slug}/conserjeria/retiro?ok=${encodeURIComponent(`Depto ${unitLabel}`)}`);
}

export async function pickupByTokenAction(slug: string, scanned: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");

  const token = extractPickupToken(scanned);
  if (!token) throw new Error("INVALID_QR");

  const result = await pickupPackage({
    tenantId: tenant.id,
    pickupToken: token,
  });
  return { unitLabel: result.unitLabel, packageId: result.packageId };
}
