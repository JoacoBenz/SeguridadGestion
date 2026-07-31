import { NextResponse } from "next/server";
import { purgeExpiredPhotos } from "@/server/packages/photo-retention";

// Disparado por Vercel Cron (ver vercel.json) una vez por día. Misma auth que
// /api/cron/reminders: `Authorization: Bearer ${CRON_SECRET}`.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      console.error("[cron/photo-retention] CRON_SECRET no configurado en producción");
      return new NextResponse("misconfigured", { status: 500 });
    }
    console.warn("[cron/photo-retention] sin CRON_SECRET — permitido solo en dev");
  } else if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const result = await purgeExpiredPhotos();
  console.log(
    `[cron/photo-retention] scanned=${result.scanned} deleted=${result.photosDeleted} failed=${result.failed} tenantsSkipped=${result.tenantsSkipped}`,
  );
  return NextResponse.json({ ok: true, ...result });
}
