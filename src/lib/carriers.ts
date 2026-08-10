// Sugerencias de transportista para el alta de paquetes.
//
// El campo es texto libre, y eso fragmenta la métrica: "Mercado Libre",
// "mercado libre" y "MERCADOLIBRE" cuentan como tres transportistas distintos
// en el ranking de reportes. Ofrecer como chips lo que ya se cargó hace que el
// guardia toque en vez de tipear, y el nombre converge solo a una única forma.
//
// Módulo puro y testeable.

export interface CarrierCount {
  carrier: string | null;
  count: number;
}

const MAX_SUGGESTIONS = 8;

/**
 * Colapsa el historial de transportistas en una lista de sugerencias.
 *
 * Agrupa sin distinguir mayúsculas/espacios ("Mercado Libre" y "mercado libre"
 * son el mismo), conserva la grafía de la variante más usada, y ordena por
 * frecuencia total. Devuelve como mucho MAX_SUGGESTIONS.
 */
export function foldCarrierSuggestions(rows: CarrierCount[]): string[] {
  const groups = new Map<string, { total: number; variants: Map<string, number> }>();

  for (const row of rows) {
    const raw = row.carrier?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase().replace(/\s+/g, " ");
    const group = groups.get(key) ?? { total: 0, variants: new Map() };
    group.total += row.count;
    group.variants.set(raw, (group.variants.get(raw) ?? 0) + row.count);
    groups.set(key, group);
  }

  return [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_SUGGESTIONS)
    .map((g) => [...g.variants.entries()].sort((a, b) => b[1] - a[1])[0]![0]);
}
