import { describe, expect, it } from "vitest";
import { TEMPLATES, assertParamCount } from "@/lib/whatsapp/templates";

describe("WhatsApp templates", () => {
  it("todas las plantillas declaran lenguaje y nombre", () => {
    for (const spec of Object.values(TEMPLATES)) {
      expect(spec.name).toMatch(/_v\d+$/);
      expect(spec.language).toMatch(/^[a-z]{2}(_[A-Z]{2})?$/);
      expect(spec.paramCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("assertParamCount rechaza el largo equivocado", () => {
    expect(() => assertParamCount("paquete_recibido_v1", ["solo uno"])).toThrow();
    expect(() =>
      assertParamCount("paquete_recibido_v1", ["a", "b", "c", "d", "e"]),
    ).not.toThrow();
  });
});
