import { describe, expect, it } from "vitest";
import { TEMPLATES, assertParamCount } from "@/lib/whatsapp/templates";
import { buildComponents } from "@/lib/whatsapp/client";

describe("WhatsApp templates", () => {
  it("todas las plantillas declaran lenguaje, nombre y nombres de variables", () => {
    for (const spec of Object.values(TEMPLATES)) {
      expect(spec.name).toMatch(/_v\d+$/);
      expect(spec.language).toMatch(/^[a-z]{2}(_[A-Z]{2})?$/);
      expect(Array.isArray(spec.bodyParamNames)).toBe(true);
      // Meta exige nombres en minúscula, con guiones bajos o números.
      for (const n of spec.bodyParamNames) {
        expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it("paquete_recibido_v3 tiene header image y 4 variables nombradas", () => {
    expect(TEMPLATES.paquete_recibido_v3.hasImageHeader).toBe(true);
    expect(TEMPLATES.paquete_recibido_v3.bodyParamNames).toEqual([
      "nombre",
      "edificio",
      "unidad",
    ]);
  });

  it("assertParamCount cuenta sólo los del body, no el header", () => {
    expect(() => assertParamCount("paquete_recibido_v3", ["solo uno"])).toThrow();
    expect(() =>
      assertParamCount("paquete_recibido_v3", ["a", "b", "c"]),
    ).not.toThrow();
  });
});

describe("paquete_foto_v1", () => {
  it("declara header de imagen y 1 variable (unidad)", () => {
    expect(TEMPLATES.paquete_foto_v1.hasImageHeader).toBe(true);
    expect(TEMPLATES.paquete_foto_v1.bodyParamNames).toEqual(["unidad"]);
    expect(() => assertParamCount("paquete_foto_v1", ["3B"])).not.toThrow();
    expect(() => assertParamCount("paquete_foto_v1", [])).toThrow();
  });
});

describe("buildComponents (payload para Meta)", () => {
  it("emite parameter_name apareado por posición con los nombres de la plantilla", () => {
    const comps = buildComponents("paquete_recibido_v3", ["Juan", "Edificio Libertad", "3B"], "https://x/qr.png");
    const header = comps.find((c) => c.type === "header");
    const body = comps.find((c) => c.type === "body");
    expect(header?.parameters[0]).toEqual({ type: "image", image: { link: "https://x/qr.png" } });
    expect(body?.parameters).toEqual([
      { type: "text", parameter_name: "nombre", text: "Juan" },
      { type: "text", parameter_name: "edificio", text: "Edificio Libertad" },
      { type: "text", parameter_name: "unidad", text: "3B" },
    ]);
  });

  it("plantilla sin header no incluye componente header", () => {
    const comps = buildComponents("paquete_pendiente_v1", ["12/07/2026"]);
    expect(comps.some((c) => c.type === "header")).toBe(false);
    expect(comps[0]?.parameters).toEqual([{ type: "text", parameter_name: "fecha", text: "12/07/2026" }]);
  });
});
