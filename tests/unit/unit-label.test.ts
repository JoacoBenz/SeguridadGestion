import { describe, expect, it } from "vitest";
import { compareUnitLabels, normalizeUnitLabel, UNIT_LABEL_RE } from "@/lib/unit-label";

describe("normalizeUnitLabel", () => {
  it("acepta números + una letra mayúscula", () => {
    expect(normalizeUnitLabel("3B")).toBe("3B");
    expect(normalizeUnitLabel("12A")).toBe("12A");
    expect(normalizeUnitLabel("104C")).toBe("104C");
  });

  it("normaliza minúsculas y espacios", () => {
    expect(normalizeUnitLabel("3b")).toBe("3B");
    expect(normalizeUnitLabel("  12a  ")).toBe("12A");
  });

  it("rechaza todo lo que no sea números + una letra", () => {
    expect(normalizeUnitLabel("B3")).toBeNull(); // letra primero
    expect(normalizeUnitLabel("3")).toBeNull(); // solo números
    expect(normalizeUnitLabel("B")).toBeNull(); // solo letra
    expect(normalizeUnitLabel("3BB")).toBeNull(); // dos letras
    expect(normalizeUnitLabel("PB")).toBeNull(); // sin números
    expect(normalizeUnitLabel("3-B")).toBeNull(); // separador
    expect(normalizeUnitLabel("3 B")).toBeNull(); // espacio interno
    expect(normalizeUnitLabel("")).toBeNull();
    expect(normalizeUnitLabel("12345A")).toBeNull(); // más de 4 dígitos
  });

  it("la regex exportada matchea solo el formato final", () => {
    expect(UNIT_LABEL_RE.test("3B")).toBe(true);
    expect(UNIT_LABEL_RE.test("3b")).toBe(false); // la normalización sube a mayúscula antes
  });
});

describe("compareUnitLabels", () => {
  const sorted = (labels: string[]) => [...labels].sort(compareUnitLabels);

  it("ordena por piso como número, no como texto", () => {
    // Como texto, "10A" y "30A" quedarían antes que "1A" y "3A".
    expect(sorted(["10A", "1A", "30A", "3A", "2A"])).toEqual([
      "1A",
      "2A",
      "3A",
      "10A",
      "30A",
    ]);
  });

  it("dentro del mismo piso ordena por letra", () => {
    expect(sorted(["3D", "3A", "3C", "3B"])).toEqual(["3A", "3B", "3C", "3D"]);
  });

  it("ordena bien un edificio de 200 deptos", () => {
    const labels: string[] = [];
    for (let f = 1; f <= 50; f++) for (const l of ["A", "B", "C", "D"]) labels.push(`${f}${l}`);
    const shuffled = [...labels].reverse();
    const result = sorted(shuffled);
    expect(result[0]).toBe("1A");
    expect(result[3]).toBe("1D");
    expect(result[4]).toBe("2A");
    expect(result[result.length - 1]).toBe("50D");
  });

  it("no rompe con etiquetas sin número adelante", () => {
    expect(() => sorted(["PB", "3A"])).not.toThrow();
  });
});
