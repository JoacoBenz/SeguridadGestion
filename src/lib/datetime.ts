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
