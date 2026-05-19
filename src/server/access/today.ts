// Pura: dado un tenant + un Date, devuelve las autorizaciones que aplican
// ese día. El caller tiene que haber autorizado antes.
//
// NOTA: cuando exista VisitorEvent (plan base del chatbot), este módulo unifica
// VisitorEvent + RecurringAuthorization en un solo listado, ordenado por hora.
// Por ahora sólo devuelve recurrentes.

import { prisma } from "@/lib/db";

export interface RecurringTodayRow {
  kind: "recurring";
  id: string;
  unitId: string;
  unitLabel: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;
}

export type AuthorizationsTodayRow = RecurringTodayRow;

// JS getDay() en la zona horaria del server. El tenant puede vivir en otra TZ;
// para v1 asumimos que el server corre en UTC y el tenant es AR. Pasar el
// `now` permite testear contra fechas fijas.
function weekdayInTz(date: Date, timeZone: string): number {
  // Usa Intl para obtener el weekday según la TZ del tenant.
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone,
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[wd] ?? date.getDay();
}

export async function listAuthorizationsForToday(
  tenantId: string,
  now: Date,
): Promise<AuthorizationsTodayRow[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  const tz = tenant?.timezone ?? "America/Argentina/Buenos_Aires";
  const today = weekdayInTz(now, tz);

  const recurring = await prisma.recurringAuthorization.findMany({
    where: {
      tenantId,
      status: "active",
      daysOfWeek: { has: today },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    include: { unit: { select: { id: true, label: true } } },
  });

  const rows: AuthorizationsTodayRow[] = recurring.map((r) => ({
    kind: "recurring",
    id: r.id,
    unitId: r.unit.id,
    unitLabel: r.unit.label,
    name: r.name,
    startTime: r.startTime,
    endTime: r.endTime,
  }));

  // Orden por hora de inicio (string "HH:MM" comparable lexicográficamente).
  rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return rows;
}

// Útil para conserjería: residentes en vacaciones hoy.
export async function listResidentsOnVacation(
  tenantId: string,
  now: Date,
): Promise<Array<{ userId: string; name: string; unitLabel: string | null }>> {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      role: "resident",
      vacationStart: { lte: now },
      vacationEnd: { gte: now },
    },
    include: {
      unitMemberships: {
        include: { unit: { select: { label: true } } },
        take: 1,
      },
    },
  });
  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    unitLabel: u.unitMemberships[0]?.unit.label ?? null,
  }));
}
