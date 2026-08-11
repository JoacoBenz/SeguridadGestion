import { describe, expect, it } from "vitest";
import {
  summarizeFailures,
  type FailedNotificationRow,
} from "@/server/superadmin/notification-health";

function row(overrides: Partial<FailedNotificationRow>): FailedNotificationRow {
  return {
    tenantSlug: "edificio-a",
    tenantName: "Edificio A",
    templateName: "paquete_recibido_v3",
    errorMessage: "token expirado",
    createdAt: new Date("2026-08-11T12:00:00Z"),
    ...overrides,
  };
}

describe("summarizeFailures", () => {
  it("sin fallos devuelve vacío", () => {
    expect(summarizeFailures([])).toEqual([]);
  });

  it("agrupa por edificio y cuenta", () => {
    const out = summarizeFailures([
      row({}),
      row({}),
      row({ tenantSlug: "edificio-b", tenantName: "Edificio B" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ slug: "edificio-a", count: 2 });
    expect(out[1]).toMatchObject({ slug: "edificio-b", count: 1 });
  });

  it("ordena por cantidad de fallos, el peor primero", () => {
    const out = summarizeFailures([
      row({ tenantSlug: "edificio-b", tenantName: "Edificio B" }),
      row({ tenantSlug: "edificio-b", tenantName: "Edificio B" }),
      row({ tenantSlug: "edificio-b", tenantName: "Edificio B" }),
      row({}),
    ]);
    expect(out.map((t) => t.slug)).toEqual(["edificio-b", "edificio-a"]);
  });

  it("junta las plantillas afectadas sin repetir", () => {
    const out = summarizeFailures([
      row({}),
      row({ templateName: "paquete_foto_v1" }),
      row({ templateName: "paquete_foto_v1" }),
    ]);
    expect(out[0]!.templates).toEqual(["paquete_recibido_v3", "paquete_foto_v1"]);
  });

  it("el último error es el del fallo más reciente, sin importar el orden de entrada", () => {
    const out = summarizeFailures([
      row({ errorMessage: "viejo", createdAt: new Date("2026-08-11T08:00:00Z") }),
      row({ errorMessage: "nuevo", createdAt: new Date("2026-08-11T14:00:00Z") }),
      row({ errorMessage: "medio", createdAt: new Date("2026-08-11T10:00:00Z") }),
    ]);
    expect(out[0]!.lastError).toBe("nuevo");
    expect(out[0]!.lastAt).toEqual(new Date("2026-08-11T14:00:00Z"));
  });

  it("un fallo sin mensaje no borra el último error conocido", () => {
    const out = summarizeFailures([
      row({ errorMessage: "token expirado", createdAt: new Date("2026-08-11T10:00:00Z") }),
      row({ errorMessage: null, createdAt: new Date("2026-08-11T11:00:00Z") }),
    ]);
    expect(out[0]!.lastError).toBe("token expirado");
    expect(out[0]!.lastAt).toEqual(new Date("2026-08-11T11:00:00Z"));
  });
});
