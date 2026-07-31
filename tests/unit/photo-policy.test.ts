import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHOTO_MODE,
  DEFAULT_PHOTO_RETENTION_DAYS,
  isPhotoEphemeral,
  isPhotoRequired,
  photoCopyPhone,
  photoMode,
  photoRetentionCutoff,
  photoRetentionDays,
  shouldShowPhotoField,
} from "@/lib/photo-policy";

describe("photoMode", () => {
  it("lee el modo configurado", () => {
    expect(photoMode({ photoMode: "optional" })).toBe("optional");
    expect(photoMode({ photoMode: "disabled" })).toBe("disabled");
  });

  it("cae al default con settings vacíos, nulos o basura", () => {
    expect(photoMode({})).toBe(DEFAULT_PHOTO_MODE);
    expect(photoMode(null)).toBe(DEFAULT_PHOTO_MODE);
    expect(photoMode("no soy un objeto")).toBe(DEFAULT_PHOTO_MODE);
    expect(photoMode({ photoMode: "cualquier cosa" })).toBe(DEFAULT_PHOTO_MODE);
  });

  it("el default preserva el comportamiento previo (obligatoria)", () => {
    expect(DEFAULT_PHOTO_MODE).toBe("required");
  });
});

describe("shouldShowPhotoField / isPhotoRequired", () => {
  it("sin storage no se pide foto, aunque el edificio la marque obligatoria", () => {
    expect(shouldShowPhotoField(false, "required")).toBe(false);
    expect(isPhotoRequired(false, "required")).toBe(false);
  });

  it("obligatoria: se muestra y frena el alta", () => {
    expect(shouldShowPhotoField(true, "required")).toBe(true);
    expect(isPhotoRequired(true, "required")).toBe(true);
  });

  it("opcional: se muestra pero no frena", () => {
    expect(shouldShowPhotoField(true, "optional")).toBe(true);
    expect(isPhotoRequired(true, "optional")).toBe(false);
  });

  it("deshabilitada: ni se muestra", () => {
    expect(shouldShowPhotoField(true, "disabled")).toBe(false);
    expect(isPhotoRequired(true, "disabled")).toBe(false);
  });
});

describe("isPhotoEphemeral", () => {
  it("por default se borra apenas se envía", () => {
    expect(isPhotoEphemeral({})).toBe(true);
    expect(isPhotoEphemeral(null)).toBe(true);
  });

  it("respeta el valor configurado", () => {
    expect(isPhotoEphemeral({ photoEphemeral: false })).toBe(false);
    expect(isPhotoEphemeral({ photoEphemeral: true })).toBe(true);
  });

  it("un valor no booleano no desactiva el borrado por accidente", () => {
    expect(isPhotoEphemeral({ photoEphemeral: "false" })).toBe(true);
    expect(isPhotoEphemeral({ photoEphemeral: 0 })).toBe(true);
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
    expect(photoCopyPhone({ conserjeriaPhone: 5491123885910 })).toBeNull();
  });
});

describe("photoRetentionDays", () => {
  it("lee el valor configurado", () => {
    expect(photoRetentionDays({ photoRetentionDays: 30 })).toBe(30);
  });

  it("0 es válido y significa 'no borrar'", () => {
    expect(photoRetentionDays({ photoRetentionDays: 0 })).toBe(0);
  });

  it("cae al default si falta o no es número", () => {
    expect(photoRetentionDays({})).toBe(DEFAULT_PHOTO_RETENTION_DAYS);
    expect(photoRetentionDays({ photoRetentionDays: "60" })).toBe(
      DEFAULT_PHOTO_RETENTION_DAYS,
    );
    expect(photoRetentionDays({ photoRetentionDays: NaN })).toBe(
      DEFAULT_PHOTO_RETENTION_DAYS,
    );
  });

  it("un negativo no desactiva el borrado por accidente", () => {
    expect(photoRetentionDays({ photoRetentionDays: -5 })).toBe(
      DEFAULT_PHOTO_RETENTION_DAYS,
    );
  });

  it("topea valores absurdos", () => {
    expect(photoRetentionDays({ photoRetentionDays: 999999 })).toBe(3650);
  });
});

describe("photoRetentionCutoff", () => {
  const now = new Date("2026-07-30T12:00:00Z");

  it("devuelve la fecha límite hacia atrás", () => {
    expect(photoRetentionCutoff(now, 60)).toEqual(new Date("2026-05-31T12:00:00Z"));
  });

  it("null cuando la retención está desactivada", () => {
    expect(photoRetentionCutoff(now, 0)).toBeNull();
  });

  it("un paquete cerrado justo en el borde todavía no se purga", () => {
    const cutoff = photoRetentionCutoff(now, 30)!;
    const closedJustAfter = new Date(cutoff.getTime() + 1);
    expect(closedJustAfter > cutoff).toBe(true);
  });
});
