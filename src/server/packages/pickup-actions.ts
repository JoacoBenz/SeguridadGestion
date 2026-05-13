"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { pickupPackage } from "@/server/packages/pickup";

// Extracts the pickupToken from either a raw token or the full /p/<token> URL
// emitted by the resident's pickup page. The QR encodes the URL, but a guard
// could also paste a token directly.
function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/").filter(Boolean);
    return parts.at(-1) ?? null;
  }
  return trimmed;
}

export async function pickupByCodeAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) redirect(`/${slug}/conserjeria/retiro?error=Edificio+no+encontrado`);

  const raw = formData.get("pickupCode");
  if (typeof raw !== "string" || !raw.trim()) {
    redirect(`/${slug}/conserjeria/retiro?error=Ingres%C3%A1+un+c%C3%B3digo`);
  }

  try {
    const result = await pickupPackage({
      tenantId: tenant.id,
      pickupCode: raw.trim().toUpperCase(),
    });
    redirect(`/${slug}/conserjeria/retiro?ok=Depto+${result.unitLabel}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ERROR";
    redirect(`/${slug}/conserjeria/retiro?error=${encodeURIComponent(msg)}`);
  }
}

export async function pickupByTokenAction(slug: string, scanned: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");

  const token = extractToken(scanned);
  if (!token) throw new Error("INVALID_QR");

  const result = await pickupPackage({
    tenantId: tenant.id,
    pickupToken: token,
  });
  return { unitLabel: result.unitLabel, packageId: result.packageId };
}
