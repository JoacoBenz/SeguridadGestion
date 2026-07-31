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

/**
 * Orden natural: primero el piso como número, después la letra.
 *
 * Ordenar como texto pone "10A" antes que "1A" (porque '0' < 'A') y "30A"
 * antes que "3A". Con pocos deptos casi no se nota; con 200 el guardia busca
 * "3" y le aparece el piso 30 arriba de todo.
 */
export function compareUnitLabels(a: string, b: string): number {
  const floorA = parseInt(a, 10);
  const floorB = parseInt(b, 10);
  if (Number.isNaN(floorA) || Number.isNaN(floorB)) return a.localeCompare(b, "es");
  if (floorA !== floorB) return floorA - floorB;
  return a.localeCompare(b, "es");
}
