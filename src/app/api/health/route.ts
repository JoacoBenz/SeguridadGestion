import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStorageClient } from "@/lib/storage/client";

// Endpoint de monitoreo (UptimeRobot, Vercel checks, etc.). Devuelve 200 si
// la app responde y llega a la base; 503 si la DB no contesta. La respuesta
// pública no expone datos; con ?debug=$CRON_SECRET incluye diagnóstico de
// configuración: destino de DB sanitizado (nunca la contraseña), estado del
// storage y qué variables STORAGE_* faltan.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizedDbTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "DATABASE_URL is not set";
  try {
    const u = new URL(url);
    return `${u.username || "(no user)"}@${u.hostname}:${u.port || "(default)"}${u.pathname}${u.search}`;
  } catch {
    return "DATABASE_URL is not a valid URL (quotes/whitespace pasted into the value?)";
  }
}

// Solo NOMBRES de variables faltantes — jamás valores.
function missingStorageVars(): string[] {
  return [
    "STORAGE_BUCKET",
    "STORAGE_PUBLIC_BASE_URL",
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_SECRET_ACCESS_KEY",
  ].filter((name) => !process.env[name]);
}

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug");
  const debugOk = Boolean(process.env.CRON_SECRET) && debug === process.env.CRON_SECRET;

  try {
    await prisma.$queryRaw`SELECT 1`;
    const body: Record<string, unknown> = { ok: true, db: "up" };
    if (debugOk) {
      body.storageConfigured = getStorageClient().isConfigured;
      body.storageMissingVars = missingStorageVars();
    }
    return NextResponse.json(body);
  } catch (err) {
    const detail = `target: ${sanitizedDbTarget()} — error: ${
      err instanceof Error ? err.message : String(err)
    }`;
    console.error(`[health] db down — ${detail}`);

    const body: Record<string, unknown> = { ok: false, db: "down" };
    if (debugOk) {
      body.detail = detail;
      body.storageConfigured = getStorageClient().isConfigured;
      body.storageMissingVars = missingStorageVars();
    }
    return NextResponse.json(body, { status: 503 });
  }
}
