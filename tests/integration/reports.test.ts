import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildMonthlyReport } from "@/server/admin/reports";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";

// El conteo de los reportes contra Postgres real. Son consultas fáciles de
// escribir mal de formas que sólo se notan cruzando los números a mano.

const prisma = new PrismaClient();

// Un "ahora" fijo a mitad de mes, para que los casos de borde sean explícitos.
const NOW = new Date("2026-08-15T12:00:00Z");
// El mes arrancó el 1/8 a las 00:00 ART = 1/8 03:00 UTC.
const JUST_INSIDE = new Date("2026-08-01T04:00:00Z"); // 01:00 ART del 1/8
const JUST_OUTSIDE = new Date("2026-08-01T01:00:00Z"); // 22:00 ART del 31/7
const LAST_MONTH = new Date("2026-07-10T12:00:00Z");

let tenantId: string;
let unitA: string;
let unitB: string;
let guardId: string;

interface PkgSpec {
  receivedAt: Date;
  status?: "awaiting_pickup" | "picked_up" | "cancelled";
  pickedUpAt?: Date;
  cancelledAt?: Date;
  carrier?: string | null;
  unitId?: string;
}

async function seed(specs: PkgSpec[]) {
  for (const [i, spec] of specs.entries()) {
    await prisma.package.create({
      data: {
        tenantId,
        unitId: spec.unitId ?? unitA,
        receivedByUserId: guardId,
        pickupCode: `R${String(i).padStart(5, "0")}`,
        receivedAt: spec.receivedAt,
        status: spec.status ?? "awaiting_pickup",
        pickedUpAt: spec.pickedUpAt ?? null,
        pickedUpByUserId: spec.pickedUpAt ? guardId : null,
        cancelledAt: spec.cancelledAt ?? null,
        carrier: spec.carrier ?? null,
      },
    });
  }
}

const report = () => buildMonthlyReport(tenantId, DEFAULT_TIMEZONE, NOW);

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  tenantId = (
    await prisma.tenant.create({
      data: { slug: `it-rep-${suffix}`, name: "Edificio Test" },
    })
  ).id;
  unitA = (await prisma.unit.create({ data: { tenantId, label: "1A" } })).id;
  unitB = (await prisma.unit.create({ data: { tenantId, label: "2B" } })).id;
  guardId = (
    await prisma.user.create({
      data: {
        tenantId,
        email: `guard-rep-${suffix}@test.local`,
        name: "Guardia",
        role: "guard",
      },
    })
  ).id;
});

afterAll(async () => {
  await prisma.package.deleteMany({ where: { tenantId } });
  await prisma.unit.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.package.deleteMany({ where: { tenantId } });
});

describe("límite del mes en la zona del edificio", () => {
  it("cuenta un paquete de la 1 AM del día 1", async () => {
    await seed([{ receivedAt: JUST_INSIDE }]);
    expect((await report()).received).toBe(1);
  });

  it("NO cuenta uno de las 22:00 del último día del mes anterior", async () => {
    // Ese instante es 01:00 UTC del 1/8: con el cálculo viejo (medianoche UTC)
    // caía adentro del mes y sumaba de más.
    await seed([{ receivedAt: JUST_OUTSIDE }]);
    expect((await report()).received).toBe(0);
  });
});

describe("retirados", () => {
  it("separa 'retirados este mes' de 'retirados del cohorte del mes'", async () => {
    await seed([
      // Llegó el mes pasado, se retiró este mes: cuenta como retiro del mes,
      // pero no pertenece al cohorte de recibidos de este mes.
      { receivedAt: LAST_MONTH, status: "picked_up", pickedUpAt: NOW },
      // Llegó y se retiró este mes: cuenta en los dos.
      { receivedAt: JUST_INSIDE, status: "picked_up", pickedUpAt: NOW },
      // Llegó este mes y sigue pendiente.
      { receivedAt: JUST_INSIDE },
    ]);
    const r = await report();
    expect(r.received).toBe(2);
    expect(r.pickedUpThisMonth).toBe(2);
    expect(r.pickedUpFromCohort).toBe(1);
  });

  it("el porcentaje nunca pasa de 100 aunque haya retiros de meses anteriores", async () => {
    // El bug original: pickedUpThisMonth / received daba 300%.
    await seed([
      { receivedAt: LAST_MONTH, status: "picked_up", pickedUpAt: NOW },
      { receivedAt: LAST_MONTH, status: "picked_up", pickedUpAt: NOW },
      { receivedAt: JUST_INSIDE, status: "picked_up", pickedUpAt: NOW },
    ]);
    const r = await report();
    expect(r.pickedUpThisMonth).toBe(3);
    expect(r.received).toBe(1);
    expect(r.pickupRate).toBe(100);
  });

  it("sin paquetes recibidos el porcentaje es null, no una división por cero", async () => {
    const r = await report();
    expect(r.received).toBe(0);
    expect(r.pickupRate).toBeNull();
  });
});

describe("cancelados y pendientes viejos", () => {
  it("cuenta los cancelados del mes y no los suma a retirados", async () => {
    await seed([
      { receivedAt: JUST_INSIDE, status: "cancelled", cancelledAt: NOW },
      { receivedAt: JUST_INSIDE, status: "picked_up", pickedUpAt: NOW },
    ]);
    const r = await report();
    expect(r.cancelled).toBe(1);
    expect(r.pickedUpThisMonth).toBe(1);
  });

  it("pendientes con más de 3 días, sin contar los recientes ni los cerrados", async () => {
    const old = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fresh = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
    await seed([
      { receivedAt: old },
      { receivedAt: fresh },
      { receivedAt: old, status: "picked_up", pickedUpAt: NOW },
    ]);
    expect((await report()).stalePending).toBe(1);
  });
});

describe("rankings", () => {
  it("'Sin transportista' puede quedar primero si es el más grande", async () => {
    // El bug: ordenar por _count.carrier cuenta no-nulos, así que el grupo sin
    // transportista puntuaba 0 y quedaba último aunque fuera mayoría.
    await seed([
      { receivedAt: JUST_INSIDE, carrier: null },
      { receivedAt: JUST_INSIDE, carrier: null },
      { receivedAt: JUST_INSIDE, carrier: null },
      { receivedAt: JUST_INSIDE, carrier: "Andreani" },
    ]);
    const r = await report();
    expect(r.topCarriers[0]).toEqual({ label: "Sin transportista", count: 3 });
    expect(r.topCarriers[1]).toEqual({ label: "Andreani", count: 1 });
  });

  it("los deptos salen con su etiqueta y ordenados por cantidad", async () => {
    await seed([
      { receivedAt: JUST_INSIDE, unitId: unitB },
      { receivedAt: JUST_INSIDE, unitId: unitB },
      { receivedAt: JUST_INSIDE, unitId: unitA },
    ]);
    const r = await report();
    expect(r.topUnits[0]).toEqual({ label: "2B", count: 2 });
    expect(r.topUnits[1]).toEqual({ label: "1A", count: 1 });
  });
});

describe("promedio a retiro", () => {
  it("promedia las horas entre recepción y retiro", async () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000);
    await seed([
      { receivedAt: twoDaysAgo, status: "picked_up", pickedUpAt: NOW }, // 48h
      { receivedAt: fourDaysAgo, status: "picked_up", pickedUpAt: NOW }, // 96h
    ]);
    expect((await report()).avgHoursToPickup).toBe(72);
  });

  it("null cuando todavía no hubo retiros", async () => {
    await seed([{ receivedAt: JUST_INSIDE }]);
    expect((await report()).avgHoursToPickup).toBeNull();
  });
});
