import { describe, expect, it } from "vitest";
import { TEMPLATES, assertParamCount } from "@/lib/whatsapp/templates";

describe("WhatsApp templates", () => {
  it("todas las plantillas declaran lenguaje y nombre", () => {
    for (const spec of Object.values(TEMPLATES)) {
      expect(spec.name).toMatch(/_v\d+$/);
      expect(spec.language).toMatch(/^[a-z]{2}(_[A-Z]{2})?$/);
      expect(spec.bodyParamCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("paquete_recibido_v2 tiene header image", () => {
    expect(TEMPLATES.paquete_recibido_v2.hasImageHeader).toBe(true);
    expect(TEMPLATES.paquete_recibido_v2.bodyParamCount).toBe(4);
  });

  it("assertParamCount cuenta sólo los del body, no el header", () => {
    expect(() => assertParamCount("paquete_recibido_v2", ["solo uno"])).toThrow();
    expect(() =>
      assertParamCount("paquete_recibido_v2", ["a", "b", "c", "d"]),
    ).not.toThrow();
  });
});
