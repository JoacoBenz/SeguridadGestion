import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import {
  getStorageClient,
  assertAllowedImageType,
  sniffImageType,
} from "@/lib/storage/client";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — fotos de celular comprimen bien por debajo.

// Sube una foto de paquete y devuelve su URL pública. El guardia la llama antes
// de submitear el form de ingreso/retiro; la URL viaja como hidden field.
// Auth: guard o admin del tenant. El tenant se pasa por query (?slug=).
export async function POST(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "MISSING_SLUG" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "TENANT_NOT_FOUND" }, { status: 404 });
  }

  try {
    await requireTenantRole(tenant.id, ["guard", "admin"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  try {
    assertAllowedImageType(file.type);
  } catch {
    return NextResponse.json({ error: "BAD_TYPE" }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // El Content-Type lo declara el cliente; los magic bytes no mienten. Lo que
  // se sube va a un bucket público y se sirve tal cual, así que el tipo real
  // manda: un HTML etiquetado "image/jpeg" no tiene que entrar.
  const sniffed = sniffImageType(bytes);
  if (!sniffed) {
    return NextResponse.json({ error: "BAD_TYPE" }, { status: 415 });
  }

  const storage = getStorageClient();
  const { url } = await storage.put({
    body: bytes,
    contentType: sniffed,
    keyPrefix: `packages/${tenant.id}`,
  });

  return NextResponse.json({ url });
}

// Descarta una foto recién subida. La usa PhotoCapture cuando el guardia saca
// otra porque la primera salió movida: sin esto la descartada quedaba en el
// bucket hasta que el barrido de huérfanos la levantara un día después.
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const target = url.searchParams.get("url");
  if (!slug || !target) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "TENANT_NOT_FOUND" }, { status: 404 });
  }

  try {
    await requireTenantRole(tenant.id, ["guard", "admin"]);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const storage = getStorageClient();
  const key = storage.keyOf(target);
  // Sólo objetos de este bucket, y sólo del prefijo de ESTE edificio: sin el
  // segundo chequeo un guardia podría borrar las fotos de otro consorcio.
  if (!key || !key.startsWith(`packages/${tenant.id}/`)) {
    return NextResponse.json({ error: "FORBIDDEN_KEY" }, { status: 403 });
  }

  // Una foto ya asociada a un paquete no se descarta desde acá: eso sería
  // borrar la evidencia de un alta hecha. Para eso está la retención.
  const inUse = await prisma.package.findFirst({
    where: { OR: [{ photoUrl: target }, { pickupPhotoUrl: target }] },
    select: { id: true },
  });
  if (inUse) {
    return NextResponse.json({ error: "PHOTO_IN_USE" }, { status: 409 });
  }

  await storage.remove(target);
  return NextResponse.json({ ok: true });
}
