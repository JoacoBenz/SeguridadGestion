import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { getStorageClient, assertAllowedImageType } from "@/lib/storage/client";

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

  const storage = getStorageClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const { url } = await storage.put({
    body: bytes,
    contentType: file.type,
    keyPrefix: `packages/${tenant.id}`,
  });

  return NextResponse.json({ url });
}
