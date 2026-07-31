import { describe, expect, it } from "vitest";
import { isWhatsAppReady, normalizePhone } from "@/lib/phone";

function ok(raw: string): string {
  const r = normalizePhone(raw);
  if (!r.ok) throw new Error(`esperaba válido, dio: ${r.error}`);
  return r.phone;
}

function err(raw: string): string {
  const r = normalizePhone(raw);
  if (r.ok) throw new Error(`esperaba inválido, dio: ${r.phone}`);
  return r.error;
}

describe("normalizePhone — formas habituales de escribir un celular argentino", () => {
  const expected = "+5491123885910";

  it.each([
    ["ya en E.164", "+5491123885910"],
    ["E.164 con espacios", "+54 9 11 2388 5910"],
    ["E.164 con guiones", "+54 9 11 2388-5910"],
    ["nacional con 0 y 15", "011 15 2388-5910"],
    ["nacional con 15 sin 0", "11 15 2388 5910"],
    ["nacional sin 0 ni 15", "1123885910"],
    ["nacional con 0 sin 15", "01123885910"],
    ["con paréntesis", "(011) 2388-5910".replace("2388-5910", "15 2388-5910")],
    ["prefijo internacional 00", "005491123885910"],
    ["sin el 9 de móvil", "+541123885910"],
    ["código de país sin el +, como lo muestra WhatsApp", "5491123885910"],
    ["código de país sin + ni 9", "541123885910"],
  ])("%s → %s", (_label, input) => {
    expect(ok(input)).toBe(expected);
  });

  it("acepta códigos de área de 4 dígitos (interior)", () => {
    // Bariloche: 2944 + 6 dígitos.
    expect(ok("+5492944805273")).toBe("+5492944805273");
    expect(ok("02944 15 805273")).toBe("+5492944805273");
  });
});

describe("normalizePhone — los errores que rompían el envío", () => {
  it("no convierte un número nacional en uno de Estados Unidos", () => {
    // El bug real: "1123885910" se guardaba como "+1123885910" (+1 = EEUU).
    expect(ok("1123885910")).toBe("+5491123885910");
    expect(ok("1123885910")).not.toBe("+1123885910");
  });

  it("rechaza un número demasiado corto en vez de aceptarlo", () => {
    expect(err("11238859")).toMatch(/incompleto/i);
  });

  it("rechaza un número demasiado largo", () => {
    expect(err("+54911238859101234")).toMatch(/largo/i);
  });

  it("rechaza texto", () => {
    expect(err("no tiene")).toMatch(/sólo números/i);
  });

  it("rechaza vacío", () => {
    expect(err("   ")).toMatch(/falta/i);
  });
});

describe("normalizePhone — otros países", () => {
  it("deja pasar un E.164 válido de otro país", () => {
    expect(ok("+34612345678")).toBe("+34612345678");
    expect(ok("+1 415 555 2671")).toBe("+14155552671");
  });

  it("rechaza un internacional demasiado corto", () => {
    expect(err("+3461")).toMatch(/código de país/i);
  });
});

describe("isWhatsAppReady", () => {
  it("acepta lo que produce normalizePhone", () => {
    expect(isWhatsAppReady("+5491123885910")).toBe(true);
    expect(isWhatsAppReady("+34612345678")).toBe(true);
  });

  it("rechaza lo que Meta no entrega", () => {
    expect(isWhatsAppReady("1123885910")).toBe(false); // sin +
    expect(isWhatsAppReady("+541123885910")).toBe(false); // sin el 9
  });
});
