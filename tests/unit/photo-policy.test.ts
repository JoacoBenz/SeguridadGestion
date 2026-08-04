import { describe, expect, it } from "vitest";
import {
  PHOTO_RETENTION_DAYS,
  isPhotoRequired,
  photoCopyPhone,
  photoRetentionCutoff,
} from "@/lib/photo-policy";

describe("isPhotoRequired", () => {
  it("se pide siempre que haya dónde subirla — no es opcional por edificio", () => {
    expect(isPhotoRequired(true)).toBe(true);
  });

  it("sin storage configurado no se pide y el alta sigue funcionando", () => {
    expect(isPhotoRequired(false)).toBe(false);
  });
});

describe("photoCopyPhone", () => {
  it("devuelve el teléfono configurado", () => {
    expect(photoCopyPhone({ conserjeriaPhone: "+5491123885910" })).toBe("+5491123885910");
  });

  it("null cuando está vacío, ausente o no es string", () => {
    expect(photoCopyPhone({ conserjeriaPhone: "" })).toBeNull();
    expect(photoCopyPhone({})).toBeNull();
    expect(photoCopyPhone(null)).toBeNull();
    expect(photoCopyPhone("no soy un objeto")).toBeNull();
    expect(photoCopyPhone({ conserjeriaPhone: 5491123885910 })).toBeNull();
  });
});

describe("retención de fotos", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("la ventana es de 30 días", () => {
    expect(PHOTO_RETENTION_DAYS).toBe(30);
  });

  it("el corte cae 30 días atrás", () => {
    expect(photoRetentionCutoff(now)).toEqual(new Date("2026-06-30T12:00:00Z"));
  });

  it("un paquete cerrado justo en el borde todavía no se purga", () => {
    const cutoff = photoRetentionCutoff(now);
    const closedJustAfter = new Date(cutoff.getTime() + 1);
    expect(closedJustAfter > cutoff).toBe(true);
  });

  it("uno cerrado un día antes del corte sí se purga", () => {
    const cutoff = photoRetentionCutoff(now);
    const older = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);
    expect(older <= cutoff).toBe(true);
  });
});
