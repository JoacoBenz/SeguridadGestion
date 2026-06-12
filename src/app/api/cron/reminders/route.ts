import { NextResponse } from "next/server";
import { sendPendingReminders } from "@/server/packages/reminders";

// Disparado por Vercel Cron (ver vercel.json) una vez por día. Vercel manda
// `Authorization: Bearer ${CRON_SECRET}`; sin ese header válido, 401.
// En dev sin CRON_SECRET se permite para poder probar a mano.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      console.error("[cron/reminders] CRON_SECRET no configurado en producción");
      return new NextResponse("misconfigured", { status: 500 });
    }
    console.warn("[cron/reminders] sin CRON_SECRET — permitido solo en dev");
  } else if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const result = await sendPendingReminders();
  console.log(
    `[cron/reminders] scanned=${result.scanned} sent=${result.remindersSent} skipped=${result.packagesSkipped}`,
  );
  return NextResponse.json({ ok: true, ...result });
}
