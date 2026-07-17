// Parser puro del CSV de importación de residentes. Separado del "use server"
// para poder testearlo (igual que pickup-token.ts). Formato por línea:
//   unidad,nombre,telefono,email?
// Header opcional (si la primera línea contiene "unidad" o "nombre" se saltea).
// Acepta separador coma o punto y coma.

export interface ParsedRow {
  line: number;
  unit: string;
  name: string;
  phone: string;
  email?: string;
  error?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  validCount: number;
  errorCount: number;
}

// E.164 con el + opcional (lo normalizamos agregándolo).
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitFields(line: string): string[] {
  const sep = line.includes(";") && !line.includes(",") ? ";" : ",";
  return line.split(sep).map((f) => f.trim());
}

export function parseResidentsCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedRow[] = [];
  const seenPhones = new Set<string>();

  lines.forEach((raw, i) => {
    // Saltea header solo si la 1ra fila tiene palabras de encabezado en las
    // columnas correctas (unidad y nombre) — no si "phone" aparece por casualidad
    // en un valor como "notaphone".
    if (i === 0) {
      const cols = splitFields(raw);
      const looksLikeHeader =
        /^(unidad|unit|depto|departamento)$/i.test(cols[0] ?? "") &&
        /^(nombre|name)$/i.test(cols[1] ?? "");
      if (looksLikeHeader) return;
    }

    const fields = splitFields(raw);
    const [unit, name, phoneRaw, email] = fields;
    const row: ParsedRow = {
      line: i + 1,
      unit: unit ?? "",
      name: name ?? "",
      phone: "",
    };

    if (!unit) row.error = "Falta la unidad";
    else if (!name) row.error = "Falta el nombre";
    else if (!phoneRaw) row.error = "Falta el teléfono";
    else if (!PHONE_RE.test(phoneRaw)) row.error = `Teléfono inválido: ${phoneRaw}`;
    else {
      const phone = phoneRaw.startsWith("+") ? phoneRaw : `+${phoneRaw}`;
      if (seenPhones.has(phone)) row.error = `Teléfono duplicado en el archivo: ${phone}`;
      else {
        seenPhones.add(phone);
        row.phone = phone;
      }
    }

    if (!row.error && email) {
      if (!EMAIL_RE.test(email)) row.error = `Email inválido: ${email}`;
      else row.email = email.toLowerCase();
    }

    rows.push(row);
  });

  const errorCount = rows.filter((r) => r.error).length;
  return { rows, validCount: rows.length - errorCount, errorCount };
}
