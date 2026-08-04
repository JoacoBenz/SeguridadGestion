import { describe, expect, it } from "vitest";
import { detectInstallPlatform, isStandalone } from "@/lib/install-hint";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_OLD =
  "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
// iPadOS 13+ se presenta como Macintosh: el touch es lo único que lo delata.
const IPAD_MODERN =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("detectInstallPlatform", () => {
  it("reconoce iPhone y iPad viejo", () => {
    expect(detectInstallPlatform(IPHONE)).toBe("ios");
    expect(detectInstallPlatform(IPAD_OLD)).toBe("ios");
  });

  it("reconoce un iPad moderno, que dice ser una Mac", () => {
    expect(detectInstallPlatform(IPAD_MODERN, 5)).toBe("ios");
  });

  it("no confunde una Mac de verdad con un iPad", () => {
    // Mismo user agent que el iPad moderno, pero sin touch.
    expect(detectInstallPlatform(MAC, 0)).toBe("other");
    expect(detectInstallPlatform(IPAD_MODERN, 0)).toBe("other");
  });

  it("reconoce Android", () => {
    expect(detectInstallPlatform(ANDROID)).toBe("android");
  });

  it("el escritorio cae en 'other' — ahí el navegador ya ofrece instalar solo", () => {
    expect(detectInstallPlatform(WINDOWS)).toBe("other");
  });

  it("no se rompe con un user agent vacío", () => {
    expect(detectInstallPlatform("")).toBe("other");
  });

  it("es insensible a mayúsculas", () => {
    expect(detectInstallPlatform(IPHONE.toUpperCase())).toBe("ios");
  });
});

describe("isStandalone", () => {
  it("detecta el estándar display-mode", () => {
    expect(isStandalone(true, undefined)).toBe(true);
  });

  it("detecta el propietario de iOS", () => {
    expect(isStandalone(false, true)).toBe(true);
  });

  it("en el navegador normal devuelve false", () => {
    expect(isStandalone(false, false)).toBe(false);
    expect(isStandalone(false, undefined)).toBe(false);
  });
});
