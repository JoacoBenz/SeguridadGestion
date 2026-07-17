import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Endpoint de monitoreo (UptimeRobot, Vercel checks, etc.). Devuelve 200 si
// la app responde y llega a la base; 503 si la DB no contesta. No expone
// datos — solo estado.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
