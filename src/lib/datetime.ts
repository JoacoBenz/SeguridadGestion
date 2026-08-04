// Formateo de fechas para mostrar al usuario.
//
// Las fechas se guardan en UTC. El server (Vercel) corre en UTC, así que un
// `toLocaleString("es-AR")` pelado formatea con el locale argentino pero en
// hora UTC — se lee como una hora válida y está 3 horas corrida. Encima
// es-AR usa formato 12h sin meridiem por defecto, así que las 13:52 UTC salen
// como "01:52" y ni siquiera se nota que está mal.
//
// Todas estas funciones exigen pensar en la zona: el default es el de
// `Tenant.timezone`, y quien tenga el tenant a mano debería pasarlo.

export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

const LOCALE = "es-AR";

export function formatDate(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTime(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTime(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return `${formatDate(date, timeZone)} ${formatTime(date, timeZone)}`;
}

/** Cuántos ms está adelantada `timeZone` respecto de UTC en ese instante. */
function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Hora 24 aparece como "24" en algunos runtimes para medianoche.
  const hour = get("hour") % 24;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asUtc - at.getTime();
}

/**
 * Instante UTC en que empezó el mes en curso **para el edificio**.
 *
 * `new Date(y, m, 1)` usa la zona del proceso, que en Vercel es UTC: el mes
 * arrancaría a las 21:00 del último día del mes anterior en hora argentina, y
 * los paquetes de esas tres horas se contarían en el mes equivocado.
 */
export function startOfMonthInTimeZone(
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");

  // Medianoche local del día 1, expresada en UTC: primero la tomamos como si
  // fuera UTC y después le restamos el offset de esa zona en ese momento.
  const naive = Date.UTC(year, month - 1, 1, 0, 0, 0);
  return new Date(naive - offsetMs(new Date(naive), timeZone));
}
