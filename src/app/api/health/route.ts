import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Health check para uptime monitors. Verifica que la DB responde.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch {
    return NextResponse.json({ status: "error", db: "down" }, { status: 503 });
  }
}
