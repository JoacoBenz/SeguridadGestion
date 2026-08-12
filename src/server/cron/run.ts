import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";

// Envoltorio común de los crons de Vercel: auth por CRON_SECRET + heartbeat.
//
// El heartbeat existe porque un cron que deja de dispararse no falla — solo
// deja de pasar, y nadie se entera hasta que un residente pregunta por qué no
// le recuerdan el paquete. Cada corrida (ok o con error) queda como AuditLog
// GLOBAL (tenantId null, entityType "Cron", entityId = nombre del job);
// /superadmin lee la última por job y avisa si está vieja. Sin migración: el
// modelo ya tenía tenantId nullable y el índice (entityType, entityId).

export type CronResult = Record<string, unknown>;

export async function runCron(
  name: string,
  req: Request,
  handler: () => Promise<CronResult>,
): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      console.error(`[cron/${name}] CRON_SECRET no configurado en producción`);
      return new NextResponse("misconfigured", { status: 500 });
    }
    console.warn(`[cron/${name}] sin CRON_SECRET — permitido solo en dev`);
  } else if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  try {
    const result = await handler();
    console.log(`[cron/${name}] ok ${JSON.stringify(result)}`);
    await heartbeat(name, "cron.ok", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron/${name}] failed: ${message}`);
    await heartbeat(name, "cron.failed", { message });
    return new NextResponse("cron failed", { status: 500 });
  }
}

async function heartbeat(
  name: string,
  action: "cron.ok" | "cron.failed",
  metadata: CronResult,
): Promise<void> {
  try {
    await recordAudit({
      tenantId: null,
      actorUserId: null,
      action,
      entityType: "Cron",
      entityId: name,
      metadata,
    });
  } catch (err) {
    // Un heartbeat que no se pudo escribir no debe convertir una corrida buena
    // en un 500 (Vercel reintentaría el cron entero).
    console.error(`[cron/${name}] no se pudo registrar el heartbeat:`, err);
  }
}
