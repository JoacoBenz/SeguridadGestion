import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";

// Servimos el QR como PNG bajo demanda. El contenido del QR es el token plano —
// no una URL — porque ya no existe la página /p/[token]; el guardia lo escanea
// y extractPickupToken() acepta tanto URL como token suelto.
//
// Meta WhatsApp Cloud API exige URL pública para header media, así que este
// endpoint se sirve a Meta cuando un mensaje se construye. Pública = sin auth;
// el token mismo es la capability. El cache HTTP largo está bien porque el QR
// de un token nunca cambia.

export const runtime = "nodejs";

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!TOKEN_RE.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pkg = await prisma.package.findFirst({
    where: { pickupToken: token },
    select: { id: true },
  });

  if (!pkg) {
    return new NextResponse("Not found", { status: 404 });
  }

  const png = await QRCode.toBuffer(token, {
    width: 600,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  // Node's Buffer / Uint8Array doesn't satisfy DOM's BodyInit due to a typing
  // mismatch in @types/node. Wrapping in a Blob sidesteps it.
  const body = new Blob([new Uint8Array(png)], { type: "image/png" });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
