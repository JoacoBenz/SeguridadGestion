// Parsers para input freeform de autorizaciones recurrentes.
// Se usan tanto desde el form admin (input estructurado pero con tolerancia)
// como desde el chatbot (input completamente freeform). Mantener puro y testeable.

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

// 0=Sun..6=Sat — el mismo convenio que Date.getDay().
const DAY_NAMES: Record<string, number> = {
  domingo: 0, dom: 0, d: 0,
  lunes: 1, lun: 1, l: 1,
  martes: 2, mar: 2,
  miercoles: 3, miércoles: 3, mier: 3, mié: 3, mie: 3, x: 3,
  jueves: 4, jue: 4, j: 4,
  viernes: 5, vie: 5, v: 5,
  sabado: 6, sábado: 6, sab: 6, sáb: 6, s: 6,
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .trim();
}

function parseDayToken(raw: string): number | null {
  const k = normalize(raw);
  return DAY_NAMES[k] ?? null;
}

function rangeFrom(a: number, b: number): number[] {
  // Días en el rango a..b inclusive, módulo 7 (sábado a lunes = sáb, dom, lun).
  const out: number[] = [];
  let cur = a;
  while (true) {
    out.push(cur);
    if (cur === b) break;
    cur = (cur + 1) % 7;
    if (out.length > 7) break; // defensivo
  }
  return out;
}

/**
 * Acepta:
 *   "lunes a viernes" | "L-V" | "L a V"
 *   "martes y jueves" | "mar, jue"
 *   "sábado y domingo" | "S-D"
 *   "lunes" (un solo día)
 * Devuelve días ordenados sin duplicados, 0..6.
 */
export function parseDaysOfWeek(input: string): ParseResult<number[]> {
  const cleaned = normalize(input);
  if (!cleaned) return { ok: false, error: "Faltan los días" };

  // Range form: "X a Y" | "X-Y"
  const rangeMatch = cleaned.match(/^([a-zñü]+)\s*(?:a|-|—|–)\s*([a-zñü]+)$/i);
  if (rangeMatch) {
    const a = parseDayToken(rangeMatch[1]!);
    const b = parseDayToken(rangeMatch[2]!);
    if (a === null || b === null) {
      return { ok: false, error: `No entendí "${input}". Probá "lunes a viernes".` };
    }
    return { ok: true, value: rangeFrom(a, b).sort((x, y) => x - y) };
  }

  // Listado: separadores "y", ",", ";", "/"
  const tokens = cleaned
    .split(/\s*(?:,|;|\/|\sy\s|\se\s)\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return { ok: false, error: "Faltan los días" };
  }

  const days = new Set<number>();
  for (const tok of tokens) {
    const d = parseDayToken(tok);
    if (d === null) {
      return { ok: false, error: `No entendí "${tok}". Probá "lunes" o "L".` };
    }
    days.add(d);
  }
  return { ok: true, value: [...days].sort((a, b) => a - b) };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseTimeToken(raw: string): { h: number; m: number } | null {
  const t = raw.trim().replace(/hs?$/i, "");
  // HH:MM | H:MM | HH | H
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]!);
  const min = m[2] ? Number(m[2]) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/**
 * Acepta:
 *   "08:00-12:00" | "8:00 a 12:00" | "8 a 12" | "8 a 12hs"
 * Devuelve `{ start, end }` en formato "HH:MM".
 * Rechaza ranges donde start >= end (no soportamos cruzar medianoche en v1).
 */
export function parseTimeRange(input: string): ParseResult<{ start: string; end: string }> {
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (!cleaned) return { ok: false, error: "Falta el horario" };

  const m = cleaned.match(/^(.+?)\s*(?:-|—|–|\sa\s)\s*(.+)$/i);
  if (!m) {
    return { ok: false, error: `No entendí "${input}". Probá "8 a 12" o "08:00-12:00".` };
  }
  const a = parseTimeToken(m[1]!);
  const b = parseTimeToken(m[2]!);
  if (!a || !b) {
    return { ok: false, error: `Hora inválida en "${input}".` };
  }
  if (a.h * 60 + a.m >= b.h * 60 + b.m) {
    return { ok: false, error: "El inicio tiene que ser anterior al fin." };
  }
  return {
    ok: true,
    value: { start: `${pad2(a.h)}:${pad2(a.m)}`, end: `${pad2(b.h)}:${pad2(b.m)}` },
  };
}
