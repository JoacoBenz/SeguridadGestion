import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Endpoint de monitoreo (UptimeRobot, Vercel checks, etc.). Devuelve 200 si
// la app responde y llega a la base; 503 si la DB no contesta. La respuesta
// pública no expone datos — el detalle del error va solo al log del server,
// con el destino de conexión sanitizado (nunca la contraseña).

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

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch (err) {
    console.error(
      `[health] db down — target: ${sanitizedDbTarget()} — error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
