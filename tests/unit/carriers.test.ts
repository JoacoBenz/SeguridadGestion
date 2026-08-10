import { describe, expect, it } from "vitest";
import { foldCarrierSuggestions } from "@/lib/carriers";

describe("foldCarrierSuggestions", () => {
  it("devuelve vacío sin historial", () => {
    expect(foldCarrierSuggestions([])).toEqual([]);
  });

  it("ignora null y strings vacíos/espacios", () => {
    expect(
      foldCarrierSuggestions([
        { carrier: null, count: 10 },
        { carrier: "", count: 3 },
        { carrier: "   ", count: 2 },
        { carrier: "Andreani", count: 1 },
      ]),
    ).toEqual(["Andreani"]);
  });

  it("agrupa variantes de mayúsculas y conserva la grafía más usada", () => {
    const out = foldCarrierSuggestions([
      { carrier: "mercado libre", count: 2 },
      { carrier: "Mercado Libre", count: 5 },
      { carrier: "MERCADO LIBRE", count: 1 },
    ]);
    expect(out).toEqual(["Mercado Libre"]);
  });

  it("agrupa variantes de espacios internos", () => {
    const out = foldCarrierSuggestions([
      { carrier: "Mercado  Libre", count: 1 },
      { carrier: "Mercado Libre", count: 3 },
    ]);
    expect(out).toEqual(["Mercado Libre"]);
  });

  it("ordena por frecuencia total del grupo, no de la variante", () => {
    const out = foldCarrierSuggestions([
      { carrier: "OCA", count: 4 },
      // El grupo "andreani" suma 5 (3+2) y le gana a OCA aunque
      // ninguna variante sola llegue a 4.
      { carrier: "Andreani", count: 3 },
      { carrier: "andreani", count: 2 },
    ]);
    expect(out).toEqual(["Andreani", "OCA"]);
  });

  it("corta en 8 sugerencias", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      carrier: `Transportista ${String.fromCharCode(65 + i)}`,
      count: 12 - i,
    }));
    const out = foldCarrierSuggestions(rows);
    expect(out).toHaveLength(8);
    expect(out[0]).toBe("Transportista A");
    expect(out).not.toContain("Transportista I");
  });

  it("recorta espacios alrededor antes de agrupar", () => {
    const out = foldCarrierSuggestions([
      { carrier: " Andreani ", count: 1 },
      { carrier: "Andreani", count: 2 },
    ]);
    expect(out).toEqual(["Andreani"]);
  });
});
