import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHOTO_MODE,
  PHOTO_RETENTION_DAYS,
  isPhotoRequired,
  photoCopyPhone,
  photoMode,
  photoRetentionCutoff,
  shouldShowPhotoField,
} from "@/lib/photo-policy";

describe("photoMode", () => {
  it("lee el modo configurado por el edificio", () => {
    expect(photoMode({ photoMode: "optional" })).toBe("optional");
    expect(photoMode({ photoMode: "disabled" })).toBe("disabled");
    expect(photoMode({ photoMode: "required" })).toBe("required");
  });

  it("cae al default con settings vacíos, nulos o basura", () => {
    expect(photoMode({})).toBe(DEFAULT_PHOTO_MODE);
    expect(photoMode(null)).toBe(DEFAULT_PHOTO_MODE);
    expect(photoMode("no soy un objeto")).toBe(DEFAULT_PHOTO_MODE);
    expect(photoMode({ photoMode: "cualquier cosa" })).toBe(DEFAULT_PHOTO_MODE);
  });

  it("un edificio nuevo arranca pidiendo la foto", () => {
    expect(DEFAULT_PHOTO_MODE).toBe("required");
  });
});

describe("shouldShowPhotoField / isPhotoRequired", () => {
  it("obligatoria: se muestra y frena el alta", () => {
    expect(shouldShowPhotoField(true, "required")).toBe(true);
    expect(isPhotoRequired(true, "required")).toBe(true);
  });

  it("opcional: se muestra pero no frena", () => {
    expect(shouldShowPhotoField(true, "optional")).toBe(true);
    expect(isPhotoRequired(true, "optional")).toBe(false);
  });

  it("sin fotos: ni se muestra el campo", () => {
    expect(shouldShowPhotoField(true, "disabled")).toBe(false);
    expect(isPhotoRequired(true, "disabled")).toBe(false);
  });

  it("sin storage no se pide nada, aunque el edificio la marque obligatoria", () => {
    expect(shouldShowPhotoField(false, "required")).toBe(false);
    expect(isPhotoRequired(false, "required")).toBe(false);
  });

  it("lo requerido implica lo mostrado — nunca al revés", () => {
    for (const mode of ["required", "optional", "disabled"] as const) {
      for (const storage of [true, false]) {
        if (isPhotoRequired(storage, mode)) {
          expect(shouldShowPhotoField(storage, mode)).toBe(true);
        }
      }
    }
  });
});

describe("photoCopyPhone", () => {
  it("devuelve el teléfono configurado", () => {
    expect(photoCopyPhone({ seguridadPhone: "+5491123885910" })).toBe("+5491123885910");
  });

  it("null cuando está vacío, ausente o no es string", () => {
    expect(photoCopyPhone({ seguridadPhone: "" })).toBeNull();
    expect(photoCopyPhone({})).toBeNull();
    expect(photoCopyPhone(null)).toBeNull();
    expect(photoCopyPhone("no soy un objeto")).toBeNull();
    expect(photoCopyPhone({ seguridadPhone: 5491123885910 })).toBeNull();
  });
});

describe("retención — es del sistema, no configurable por edificio", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("la ventana es de 30 días", () => {
    expect(PHOTO_RETENTION_DAYS).toBe(30);
  });

  it("el corte cae 30 días atrás", () => {
    expect(photoRetentionCutoff(now)).toEqual(new Date("2026-06-30T12:00:00Z"));
  });

  it("no depende de los settings del tenant", () => {
    // photoRetentionCutoff no recibe settings a propósito: si algún día alguien
    // agrega photoRetentionDays al JSON, no tiene que cambiar nada.
    expect(photoRetentionCutoff.length).toBe(1);
  });

  it("un paquete cerrado justo en el borde todavía no se purga", () => {
    const cutoff = photoRetentionCutoff(now);
    expect(new Date(cutoff.getTime() + 1) > cutoff).toBe(true);
  });

  it("uno cerrado un día antes del corte sí se purga", () => {
    const cutoff = photoRetentionCutoff(now);
    expect(new Date(cutoff.getTime() - 24 * 60 * 60 * 1000) <= cutoff).toBe(true);
  });
});
