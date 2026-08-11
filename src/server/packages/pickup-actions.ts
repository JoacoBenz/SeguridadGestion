"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { pickupPackage } from "@/server/packages/pickup";
import { extractPickupToken } from "@/server/packages/pickup-token";

// Los códigos de error internos son ingleses y greppables; al guardia le
// mostramos siempre castellano. El default genérico evita filtrar internals.
function friendlyPickupError(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  switch (code) {
    case "PACKAGE_NOT_FOUND":
      return "No hay ningún paquete pendiente con ese código";
    case "INVALID_CODE":
      return "El código no tiene un formato válido";
    case "INVALID_QR":
      return "Ese QR no parece un código de retiro de PackItO";
    case "UNAUTHENTICATED":
      return "Tu sesión expiró. Volvé a iniciar sesión.";
    case "FORBIDDEN_TENANT":
    case "FORBIDDEN_ROLE":
      return "No tenés permiso para procesar retiros en este edificio";
    default:
      return "No se pudo procesar el retiro. Probá de nuevo.";
  }
}

export async function pickupByCodeAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) redirect(`/${slug}/seguridad/retiro?error=Edificio+no+encontrado`);

  const raw = formData.get("pickupCode");
  if (typeof raw !== "string" || !raw.trim()) {
    redirect(`/${slug}/seguridad/retiro?error=${encodeURIComponent("Ingresá un código")}`);
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
    redirect(
      `/${slug}/seguridad/retiro?error=${encodeURIComponent(friendlyPickupError(err))}`,
    );
  }

  redirect(`/${slug}/seguridad/retiro?ok=${encodeURIComponent(`Depto ${unitLabel}`)}`);
}

export type PickupByTokenResult =
  | { ok: true; unitLabel: string; packageId: string }
  | { ok: false; error: string };

// Devuelve un objeto en vez de throwear: en producción Next.js reemplaza el
// message de los errores de server actions por uno genérico, así que el
// cliente nunca vería el motivo real.
export async function pickupByTokenAction(
  slug: string,
  scanned: string,
): Promise<PickupByTokenResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Edificio no encontrado" };

  const token = extractPickupToken(scanned);
  if (!token) return { ok: false, error: friendlyPickupError(new Error("INVALID_QR")) };

  try {
    const result = await pickupPackage({
      tenantId: tenant.id,
      pickupToken: token,
    });
    return { ok: true, unitLabel: result.unitLabel, packageId: result.packageId };
  } catch (err) {
    return { ok: false, error: friendlyPickupError(err) };
  }
}
