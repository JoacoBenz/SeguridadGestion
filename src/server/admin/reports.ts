import { prisma } from "@/lib/db";
import { startOfMonthInTimeZone } from "@/lib/datetime";

// Métricas del panel de reportes. Vive acá y no dentro de la page para poder
// testear el conteo: son consultas fáciles de escribir mal de formas que no se
// notan hasta que alguien cruza los números a mano.

export interface MonthlyReport {
  /** Inicio del mes en la zona del edificio, para mostrarlo. */
  startOfMonth: Date;
  /** Paquetes recibidos en el mes. */
  received: number;
  /** De los recibidos en el mes, cuántos ya se retiraron. */
  pickedUpFromCohort: number;
  /** Retiros ocurridos en el mes, incluyan o no paquetes de meses anteriores. */
  pickedUpThisMonth: number;
  cancelled: number;
  /** Pendientes con más de 3 días — candidatos a recordatorio. */
  stalePending: number;
  /** % de los recibidos este mes que ya se retiraron. null si no hubo ninguno. */
  pickupRate: number | null;
  /** Promedio de horas hasta el retiro, sobre los últimos retiros. */
  avgHoursToPickup: number | null;
  topCarriers: Array<{ label: string; count: number }>;
  topUnits: Array<{ label: string; count: number }>;
}

const STALE_DAYS = 3;
const SPEED_WINDOW_DAYS = 30;
const SPEED_SAMPLE = 200;
const TOP_N = 5;

export async function buildMonthlyReport(
  tenantId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<MonthlyReport> {
  const startOfMonth = startOfMonthInTimeZone(now, timeZone);
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const speedWindow = new Date(now.getTime() - SPEED_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // El cohorte del mes: los paquetes QUE LLEGARON este mes. Todo lo que se
  // compare contra `received` tiene que salir de acá.
  const receivedThisMonth = { tenantId, receivedAt: { gte: startOfMonth } };

  const [
    received,
    pickedUpFromCohort,
    pickedUpThisMonth,
    cancelled,
    stalePending,
    carriers,
    units,
    samples,
  ] = await Promise.all([
    prisma.package.count({ where: receivedThisMonth }),
    // Mezclar esto con "retiros del mes" daba porcentajes por encima de 100:
    // un paquete que llegó en julio y se retiró en agosto sumaba al numerador
    // sin estar nunca en el denominador.
    prisma.package.count({ where: { ...receivedThisMonth, status: "picked_up" } }),
    prisma.package.count({
      where: { tenantId, status: "picked_up", pickedUpAt: { gte: startOfMonth } },
    }),
    prisma.package.count({
      where: { tenantId, status: "cancelled", cancelledAt: { gte: startOfMonth } },
    }),
    prisma.package.count({
      where: { tenantId, status: "awaiting_pickup", receivedAt: { lte: staleBefore } },
    }),
    // Ordenar por `_count: { carrier }` cuenta valores NO nulos: el grupo "sin
    // transportista" daba 0 y quedaba último aunque fuera el más grande. `id`
    // nunca es nulo, así que contarlo equivale a contar filas.
    prisma.package.groupBy({
      by: ["carrier"],
      where: receivedThisMonth,
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: TOP_N,
    }),
    prisma.package.groupBy({
      by: ["unitId"],
      where: receivedThisMonth,
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: TOP_N,
    }),
    prisma.package.findMany({
      where: {
        tenantId,
        status: "picked_up",
        pickedUpAt: { gte: speedWindow, not: null },
      },
      // Sin orderBy, Postgres devuelve filas cualesquiera y el promedio no es
      // "de los últimos retiros" como dice el cartel.
      orderBy: { pickedUpAt: "desc" },
      select: { receivedAt: true, pickedUpAt: true },
      take: SPEED_SAMPLE,
    }),
  ]);

  const unitLabels = units.length
    ? await prisma.unit.findMany({
        where: { id: { in: units.map((u) => u.unitId) } },
        select: { id: true, label: true },
      })
    : [];
  const labelById = new Map(unitLabels.map((u) => [u.id, u.label]));

  const avgHoursToPickup =
    samples.length === 0
      ? null
      : Math.round(
          samples.reduce(
            (acc, p) => acc + (p.pickedUpAt!.getTime() - p.receivedAt.getTime()),
            0,
          ) /
            samples.length /
            (60 * 60 * 1000),
        );

  return {
    startOfMonth,
    received,
    pickedUpFromCohort,
    pickedUpThisMonth,
    cancelled,
    stalePending,
    pickupRate:
      received === 0 ? null : Math.round((pickedUpFromCohort / received) * 100),
    avgHoursToPickup,
    topCarriers: carriers.map((c) => ({
      label: c.carrier ?? "Sin transportista",
      count: c._count._all,
    })),
    topUnits: units.map((u) => ({
      label: labelById.get(u.unitId) ?? "?",
      count: u._count._all,
    })),
  };
}
