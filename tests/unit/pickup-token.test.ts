import { describe, expect, it } from "vitest";
import { extractPickupToken } from "@/server/packages/pickup-token";

describe("extractPickupToken", () => {
  it("acepta un token plano", () => {
    expect(extractPickupToken("cabc1234def56789")).toBe("cabc1234def56789");
  });

  it("extrae el último segmento de una URL completa", () => {
    expect(
      extractPickupToken("https://paqueteok.app/p/cabc1234def56789"),
    ).toBe("cabc1234def56789");
  });

  it("ignora query string y fragment", () => {
    expect(
      extractPickupToken("https://paqueteok.app/p/cabc1234def56789?utm=src&x=1"),
    ).toBe("cabc1234def56789");
    expect(
      extractPickupToken("https://paqueteok.app/p/cabc1234def56789#hash"),
    ).toBe("cabc1234def56789");
  });

  it("acepta paths sin host", () => {
    expect(extractPickupToken("/p/cabc1234def56789")).toBe("cabc1234def56789");
    expect(extractPickupToken("/p/cabc1234def56789/")).toBe("cabc1234def56789");
  });

  it("trimea espacios", () => {
    expect(extractPickupToken("  cabc1234def56789  ")).toBe("cabc1234def56789");
  });

  it("rechaza tokens muy cortos o muy largos", () => {
    expect(extractPickupToken("abc")).toBeNull();
    expect(extractPickupToken("a".repeat(200))).toBeNull();
  });

  it("rechaza caracteres no alfanuméricos", () => {
    expect(extractPickupToken("abc!@#defghij")).toBeNull();
    expect(extractPickupToken("abc def ghij")).toBeNull();
    expect(extractPickupToken("abc/def\\ghij")).toBeNull();
  });

  it("rechaza entradas vacías", () => {
    expect(extractPickupToken("")).toBeNull();
    expect(extractPickupToken("   ")).toBeNull();
    expect(extractPickupToken("/")).toBeNull();
    expect(extractPickupToken("///")).toBeNull();
  });

  it("rechaza URLs malformadas", () => {
    expect(extractPickupToken("https://[not a url")).toBeNull();
  });

  it("no se asusta con un dominio distinto (lo decide el server scopeado por tenant)", () => {
    // El server action valida que el token pertenezca al tenant correcto.
    // Acá solo verificamos que el parser saca el token.
    expect(
      extractPickupToken("https://evil.example.com/p/cabc1234def56789"),
    ).toBe("cabc1234def56789");
  });
});
