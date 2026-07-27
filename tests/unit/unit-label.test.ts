import { describe, expect, it } from "vitest";
import { normalizeUnitLabel, UNIT_LABEL_RE } from "@/lib/unit-label";

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
