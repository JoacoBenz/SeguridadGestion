"use server";

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
    case "INVALID_PHOTO_URL":
      return "La foto del retiro no es válida. Probá de nuevo.";
    case "UNAUTHENTICATED":
      return "Tu sesión expiró. Volvé a iniciar sesión.";
    case "FORBIDDEN_TENANT":
    case "FORBIDDEN_ROLE":
      return "No tenés permiso para procesar retiros en este edificio";
    default:
      return "No se pudo procesar el retiro. Probá de nuevo.";
  }
}

// Contrato único para los dos modos (QR y código): el cliente recibe un
// objeto y decide qué pintar — el popup de éxito con la foto, o el error.
// Se devuelve objeto en vez de throwear porque en producción Next.js
// reemplaza el message de los errores de server actions por uno genérico.
export type PickupActionResult =
  | {
      ok: true;
      unitLabel: string;
      packageId: string;
      /** Foto del ingreso, firmada y efímera — para saber cuál agarrar. */
      photoUrl: string | null;
      carrier: string | null;
    }
  | { ok: false; error: string };

export async function pickupByCodeAction(
  slug: string,
  code: string,
): Promise<PickupActionResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Edificio no encontrado" };

  if (typeof code !== "string" || !code.trim()) {
    return { ok: false, error: "Ingresá un código" };
  }

  try {
    const result = await pickupPackage({
      tenantId: tenant.id,
      pickupCode: code.trim().toUpperCase(),
    });
    return {
      ok: true,
      unitLabel: result.unitLabel,
      packageId: result.packageId,
      photoUrl: result.photoUrl,
      carrier: result.carrier,
    };
  } catch (err) {
    return { ok: false, error: friendlyPickupError(err) };
  }
}

export async function pickupByTokenAction(
  slug: string,
  scanned: string,
): Promise<PickupActionResult> {
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
    return {
      ok: true,
      unitLabel: result.unitLabel,
      packageId: result.packageId,
      photoUrl: result.photoUrl,
      carrier: result.carrier,
    };
  } catch (err) {
    return { ok: false, error: friendlyPickupError(err) };
  }
}
