// Pure helpers for the chat dispatcher: state constants, menu copy, and parsers.
// No imports of Prisma or "use server" code — must stay unit-testable.

export type ChatState =
  | "MENU"
  // visitor flow
  | "AWAITING_VISITOR_NAME"
  | "AWAITING_VISITOR_TIME"
  | "AWAITING_VEHICLE_PLATE"
  | "AWAITING_VISITOR_CONFIRM"
  | "AWAITING_DOOR_DECISION"
  // recurring auth flow
  | "AWAITING_RECURRING_NAME"
  | "AWAITING_RECURRING_DAYS"
  | "AWAITING_RECURRING_TIME"
  | "AWAITING_RECURRING_CONFIRM"
  // vacation flow
  | "AWAITING_VACATION_START"
  | "AWAITING_VACATION_END"
  | "AWAITING_VACATION_CONFIRM"
  // issue flow
  | "AWAITING_ISSUE_KIND"
  | "AWAITING_ISSUE_BODY"
  | "AWAITING_PANIC_CONFIRM"
  // content lookups
  | "AWAITING_FAQ_PICK"
  | "AWAITING_LOSTFOUND_PICK"
  | "AWAITING_AUTHS_LIST_PICK";

export const MENU_TEXT = [
  "Hola 👋 ¿Qué necesitás?",
  "1. Anunciar visita",
  "2. Autorización fija (recurrente)",
  "3. Modo vacaciones",
  "4. Reportar problema",
  "5. 🚨 Emergencia",
  "6. Consultar reglamento",
  "7. Objetos perdidos",
  "8. Mis autorizaciones",
  "",
  "Respondé con el número. Escribí `menu` para volver acá.",
].join("\n");

export function isGlobalReset(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "menu" || t === "volver" || t === "cancelar";
}

export function isPanicKeyword(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "emergencia" || t === "ayuda" || t === "auxilio";
}

// Parse "19:00", "7pm", "7 pm", "ahora" → minutes-since-midnight or -1 for "ahora".
// Returns null for unparseable.
export function parseTimeOfDay(input: string): number | null {
  const t = input.trim().toLowerCase();
  if (t === "ahora") return -1;
  const hhmm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
    return null;
  }
  const amPm = t.match(/^(\d{1,2})\s*(am|pm)$/);
  if (amPm) {
    let h = Number(amPm[1]);
    if (h < 1 || h > 12) return null;
    if (amPm[2] === "pm" && h !== 12) h += 12;
    if (amPm[2] === "am" && h === 12) h = 0;
    return h * 60;
  }
  return null;
}

// "HH:MM-HH:MM" → { startMin, endMin } in minutes since midnight.
export function parseTimeRange(input: string): { startMin: number; endMin: number } | null {
  const m = input.trim().match(/^(\d{1,2}:\d{2})\s*[-aA]\s*(\d{1,2}:\d{2})$/);
  if (!m || !m[1] || !m[2]) return null;
  const s = parseTimeOfDay(m[1]);
  const e = parseTimeOfDay(m[2]);
  if (s === null || e === null || s < 0 || e < 0 || e <= s) return null;
  return { startMin: s, endMin: e };
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DAY_NAMES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  lun: 1,
  mar: 2,
  mie: 3,
  mié: 3,
  jue: 4,
  vie: 5,
  sab: 6,
  sáb: 6,
  dom: 0,
  l: 1,
  m: 2,
  j: 4,
  v: 5,
  s: 6,
  d: 0,
};

// "lunes a viernes", "martes y jueves", "L-V", "L,M,J", "todos los días"
export function parseDaysOfWeek(input: string): number[] | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  if (t === "todos" || t === "todos los días" || t === "todos los dias") {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const range = t.match(/^([a-záé]+)\s*(?:a|-)\s*([a-záé]+)$/);
  if (range && range[1] && range[2]) {
    const a = DAY_NAMES[range[1]];
    const b = DAY_NAMES[range[2]];
    if (a === undefined || b === undefined) return null;
    const out: number[] = [];
    let cur = a;
    for (let i = 0; i < 7; i++) {
      out.push(cur);
      if (cur === b) return out;
      cur = (cur + 1) % 7;
    }
    return null;
  }

  const tokens = t.split(/[,\s]+y[,\s]+|[,\s]+/).filter((s) => s.length > 0);
  const days = new Set<number>();
  for (const tok of tokens) {
    if (tok === "a" || tok === "y") continue;
    const d = DAY_NAMES[tok];
    if (d === undefined) return null;
    days.add(d);
  }
  if (days.size === 0) return null;
  return [...days].sort((a, b) => a - b);
}

// "20/12", "20/12/2026", "20-12", "hoy", "mañana"
export function parseDate(input: string, now: Date = new Date()): Date | null {
  const t = input.trim().toLowerCase();
  if (t === "hoy") return startOfDay(now);
  if (t === "mañana" || t === "manana") {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3]) : now.getFullYear();
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

const ISSUE_KIND_LABEL: Record<string, "maintenance" | "noise" | "suspicious"> = {
  "1": "maintenance",
  "4a": "maintenance",
  a: "maintenance",
  mantenimiento: "maintenance",
  "2": "noise",
  "4b": "noise",
  b: "noise",
  ruido: "noise",
  disturbio: "noise",
  "3": "suspicious",
  "4c": "suspicious",
  c: "suspicious",
  sospechoso: "suspicious",
  sospecha: "suspicious",
};

export function parseIssueKind(input: string): "maintenance" | "noise" | "suspicious" | null {
  return ISSUE_KIND_LABEL[input.trim().toLowerCase()] ?? null;
}

export const DAY_ABBR_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;
