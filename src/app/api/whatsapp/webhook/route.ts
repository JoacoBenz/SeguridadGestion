import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Meta sends GET for verification handshake and POST for status callbacks.
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !appSecret) {
    console.error("[whatsapp/webhook] WHATSAPP_APP_SECRET no configurado en producción");
    return new NextResponse("misconfigured", { status: 500 });
  }

  if (appSecret) {
    if (!signature) return new NextResponse("missing signature", { status: 401 });
    const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return new NextResponse("invalid signature", { status: 401 });
    }
  } else {
    // Dev only: log and accept.
    console.warn("[whatsapp/webhook] firma no verificada (sin WHATSAPP_APP_SECRET)");
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(raw) as WebhookPayload;
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        await prisma.notification
          .updateMany({
            where: { providerMessageId: status.id },
            data: { status: mapStatus(status.status) },
          })
          .catch(() => undefined);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function mapStatus(s: string): "sent" | "delivered" | "read" | "failed" {
  switch (s) {
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return "sent";
  }
}

interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{ id: string; status: string }>;
      };
    }>;
  }>;
}
