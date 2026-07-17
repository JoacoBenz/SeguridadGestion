import { describe, it, expect } from "vitest";
import { parseResidentsCsv } from "@/server/admin/import-parse";

describe("parseResidentsCsv", () => {
  it("parses valid rows and normalizes phone", () => {
    const r = parseResidentsCsv(
      "unidad,nombre,telefono,email\n3B,Juan,5491133334444,juan@e.com\n5A,Ana,+5491155556666,",
    );
    expect(r.errorCount).toBe(0);
    expect(r.validCount).toBe(2);
    expect(r.rows[0]!.phone).toBe("+5491133334444"); // + agregado
    expect(r.rows[0]!.email).toBe("juan@e.com");
    expect(r.rows[1]!.email).toBeUndefined();
  });

  it("skips a header line", () => {
    const r = parseResidentsCsv("unidad,nombre,telefono\n1A,Juan,+5491100000001");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.name).toBe("Juan");
  });

  it("flags missing fields and bad phone/email", () => {
    const r = parseResidentsCsv(
      "1A,,+5491100000001\n1B,Ana,notaphone\n1C,Leo,+5491100000002,bademail",
    );
    expect(r.errorCount).toBe(3);
    expect(r.rows[0]!.error).toMatch(/nombre/i);
    expect(r.rows[1]!.error).toMatch(/inv/i);
    expect(r.rows[2]!.error).toMatch(/email/i);
  });

  it("does NOT treat a data row as a header when a value contains 'phone'", () => {
    // Regresión: "notaphone" en la columna teléfono no debe hacer que la fila
    // se tome por encabezado. Debe parsearse y marcarse teléfono inválido.
    const r = parseResidentsCsv("ZZ3,Bad,notaphone");
    expect(r.rows).toHaveLength(1);
    expect(r.errorCount).toBe(1);
    expect(r.rows[0]!.error).toMatch(/inv/i);
  });

  it("detects duplicate phone within the file", () => {
    const r = parseResidentsCsv("1A,Juan,+5491100000001\n1B,Ana,+5491100000001");
    expect(r.errorCount).toBe(1);
    expect(r.rows[1]!.error).toMatch(/duplicado/i);
  });

  it("accepts semicolon separator", () => {
    const r = parseResidentsCsv("1A;Juan;+5491100000001");
    expect(r.errorCount).toBe(0);
    expect(r.rows[0]!.unit).toBe("1A");
  });
});
