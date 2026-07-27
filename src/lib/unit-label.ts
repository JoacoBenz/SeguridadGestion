// Formato de etiqueta de unidad: números + UNA letra mayúscula concatenados
// (piso + depto: "3B", "12A", "104C"). Regla única para el alta manual, el
// import CSV y el input de la UI — módulo puro y testeable.

export const UNIT_LABEL_RE = /^\d{1,4}[A-Z]$/;
export const UNIT_LABEL_HINT = "números + una letra, ej. 3B";

// Normaliza (trim + mayúsculas, así "3b" entra como "3B") y valida.
// Devuelve null si no cumple el formato.
export function normalizeUnitLabel(raw: string): string | null {
  const label = raw.trim().toUpperCase();
  return UNIT_LABEL_RE.test(label) ? label : null;
}
