import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { registerPackage } from "@/server/packages/register";
import { pickupPackage } from "@/server/packages/pickup";
import { sendPendingReminders } from "@/server/packages/reminders";
import { buildMonthlyReport } from "@/server/admin/reports";
import { foldCarrierSuggestions } from "@/lib/carriers";
import { setSessionResolver, resetSessionResolver } from "@/lib/auth";
import { setWhatsAppClient, type WhatsAppClient } from "@/lib/whatsapp/client";

// STRESS TEST — fuera de la suite normal (vitest sólo incluye unit/integration,
// así que ni `pnpm test` ni CI lo corren). Correr a mano contra el Postgres local:
//
//   DATABASE_URL=... npx vitest run tests/stress/stress.test.ts
//
// Mide el sistema bajo contención: registros concurrentes (colisión de
// códigos con el índice parcial como backstop), carreras de doble retiro,
// y un tenant gigante (300 unidades / 5000 paquetes) para reportes, cron de
// recordatorios y sugerencias de transportista. Crea su propio tenant
// stress-* y lo limpia al final.

const stamp = Date.now().toString(36);
const NUM_UNITS = 300;
const CONCURRENT_REGISTERS = 200;
const RACE_ATTEMPTS = 50;
const BULK_PACKAGES = 5000;

let tenantId = "";
let guardId = "";
let unitIds: string[] = [];
let sent = 0;

const fastWhatsApp: WhatsAppClient = {
  async sendTemplate() {
    sent += 1;
    return { providerMessageId: `stress-${sent}` };
  },
};

function pct(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

beforeAll(async () => {
  const t = await prisma.tenant.create({
    data: { slug: `stress-${stamp}`, name: "Edificio Stress" },
  });
  tenantId = t.id;
  guardId = (
    await prisma.user.create({
      data: { tenantId, role: "guard", name: "Guardia Stress" },
    })
  ).id;

  // 300 unidades con un residente c/u (con teléfono, para que register no corte)
  const t0 = Date.now();
  await prisma.unit.createMany({
    data: Array.from({ length: NUM_UNITS }, (_, i) => ({
      tenantId,
      label: `S${String(i).padStart(3, "0")}`,
    })),
  });
  const units = await prisma.unit.findMany({ where: { tenantId }, select: { id: true } });
  unitIds = units.map((u) => u.id);
  await prisma.user.createMany({
    data: unitIds.map((_, i) => ({
      tenantId,
      role: "resident" as const,
      name: `Residente ${i}`,
      phone: `+54911${stamp.slice(-4)}${String(i).padStart(3, "0")}`.slice(0, 13),
    })),
  });
  const residents = await prisma.user.findMany({
    where: { tenantId, role: "resident" },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  await prisma.unitResident.createMany({
    data: residents.map((r, i) => ({ unitId: unitIds[i % unitIds.length]!, userId: r.id })),
  });
  console.log(`[stress] seed base: ${NUM_UNITS} unidades + residentes en ${Date.now() - t0}ms`);

  setSessionResolver(async () => ({
    userId: guardId,
    tenantId,
    role: "guard",
    name: "Guardia Stress",
  }));
  setWhatsAppClient(fastWhatsApp);
}, 120_000);

afterAll(async () => {
  resetSessionResolver();
  setWhatsAppClient(null);
  await prisma.notification.deleteMany({ where: { package: { tenantId } } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.package.deleteMany({ where: { tenantId } });
  await prisma.unitResident.deleteMany({ where: { unit: { tenantId } } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.unit.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
}, 120_000);

describe("stress", () => {
  it(`${CONCURRENT_REGISTERS} registros CONCURRENTES: todos ok, códigos únicos`, async () => {
    const latencies: number[] = [];
    const t0 = Date.now();
    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_REGISTERS }, (_, i) => {
        const start = Date.now();
        return registerPackage({
          tenantId,
          unitId: unitIds[i % unitIds.length]!,
          carrier: i % 3 === 0 ? "Mercado Libre" : i % 3 === 1 ? "Andreani" : undefined,
        }).then((r) => {
          latencies.push(Date.now() - start);
          return r;
        });
      }),
    );
    const total = Date.now() - t0;
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    const codes = new Set(
      ok.map((r) => (r as PromiseFulfilledResult<{ pickupCode: string }>).value.pickupCode),
    );
    console.log(
      `[stress] registros: ${ok.length}/${CONCURRENT_REGISTERS} ok en ${total}ms ` +
        `(${Math.round((CONCURRENT_REGISTERS / total) * 1000)}/s) | ` +
        `p50=${pct(latencies, 50)}ms p95=${pct(latencies, 95)}ms max=${Math.max(...latencies)}ms | ` +
        `fallos=${failed.length}`,
    );
    if (failed.length) {
      console.log(
        "[stress] motivos:",
        failed.slice(0, 3).map((f) => String((f as PromiseRejectedResult).reason)),
      );
    }
    expect(failed.length).toBe(0);
    expect(codes.size).toBe(CONCURRENT_REGISTERS); // ni un código repetido bajo contención
  }, 180_000);

  it(`carrera de doble retiro ×${RACE_ATTEMPTS}: exactamente UNO gana`, async () => {
    const pkg = await registerPackage({ tenantId, unitId: unitIds[0]! });
    const results = await Promise.allSettled(
      Array.from({ length: RACE_ATTEMPTS }, () =>
        pickupPackage({ tenantId, pickupToken: pkg.pickupToken }),
      ),
    );
    const wins = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[stress] carrera: ${wins} ganador de ${RACE_ATTEMPTS} intentos concurrentes`);
    expect(wins).toBe(1);
  }, 60_000);

  it("100 retiros concurrentes de 100 paquetes distintos: todos ok", async () => {
    const pkgs = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        registerPackage({ tenantId, unitId: unitIds[(i + 50) % unitIds.length]! }),
      ),
    );
    const t0 = Date.now();
    const results = await Promise.allSettled(
      pkgs.map((p) => pickupPackage({ tenantId, pickupToken: p.pickupToken })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[stress] 100 retiros concurrentes: ${ok}/100 ok en ${Date.now() - t0}ms`);
    expect(ok).toBe(100);
  }, 120_000);

  it(`tenant con ${BULK_PACKAGES} paquetes: reportes, sugerencias y recordatorios en tiempos sanos`, async () => {
    // Bulk seed: la mayoría retirados (histórico), 300 pendientes viejos (para
    // que el cron de recordatorios tenga trabajo real).
    const t0 = Date.now();
    const now = Date.now();
    const carriers = ["Mercado Libre", "Andreani", "OCA", "Correo Argentino", null];
    await prisma.package.createMany({
      data: Array.from({ length: BULK_PACKAGES }, (_, i) => {
        const pending = i < 300;
        const receivedAt = new Date(now - (pending ? 4 : (i % 90) + 1) * 24 * 3600 * 1000);
        return {
          tenantId,
          unitId: unitIds[i % unitIds.length]!,
          receivedByUserId: guardId,
          carrier: carriers[i % carriers.length],
          // Decimal de ancho fijo: único por construcción, y el "0" no existe
          // en el alfabeto real de códigos, así que tampoco choca con los
          // generados por registerPackage.
          pickupCode: `B${String(i).padStart(5, "0")}`,
          status: pending ? ("awaiting_pickup" as const) : ("picked_up" as const),
          receivedAt,
          pickedUpAt: pending ? null : new Date(receivedAt.getTime() + 36 * 3600 * 1000),
          pickedUpByUserId: pending ? null : guardId,
        };
      }),
    });
    console.log(`[stress] bulk seed ${BULK_PACKAGES} paquetes en ${Date.now() - t0}ms`);

    let t = Date.now();
    const report = await buildMonthlyReport(tenantId, "America/Argentina/Buenos_Aires");
    const reportMs = Date.now() - t;

    t = Date.now();
    const rows = await prisma.package.groupBy({
      by: ["carrier"],
      where: { tenantId, carrier: { not: null } },
      _count: { _all: true },
    });
    const suggestions = foldCarrierSuggestions(
      rows.map((r) => ({ carrier: r.carrier, count: r._count._all })),
    );
    const carriersMs = Date.now() - t;

    sent = 0;
    t = Date.now();
    const reminders = await sendPendingReminders();
    const remindersMs = Date.now() - t;

    t = Date.now();
    await prisma.package.findMany({
      where: { tenantId },
      orderBy: { receivedAt: "desc" },
      take: 20,
      include: { unit: { select: { label: true } } },
    });
    const pageMs = Date.now() - t;

    console.log(
      `[stress] reporte mensual=${reportMs}ms | sugerencias carrier=${carriersMs}ms (${suggestions.length}) | ` +
        `cron recordatorios=${remindersMs}ms (scan=${reminders.scanned}, enviados=${reminders.remindersSent}) | ` +
        `página paquetes (20 de ${BULK_PACKAGES})=${pageMs}ms`,
    );
    expect(reportMs).toBeLessThan(3000);
    expect(carriersMs).toBeLessThan(1500);
    expect(pageMs).toBeLessThan(1000);
    expect(reminders.scanned).toBeGreaterThan(0);
  }, 300_000);
});
