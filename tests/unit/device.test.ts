import { describe, expect, it } from "vitest";
import { isPhoneUserAgent } from "@/lib/device";

describe("isPhoneUserAgent", () => {
  it("detecta iPhone", () => {
    expect(
      isPhoneUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(true);
  });

  it("detecta iPod", () => {
    expect(
      isPhoneUserAgent("Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X)"),
    ).toBe(true);
  });

  it("detecta Android phone (con token Mobile)", () => {
    expect(
      isPhoneUserAgent(
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Mobile",
      ),
    ).toBe(true);
  });

  it("NO trata Android tablet (sin Mobile) como teléfono", () => {
    // Tablets Android omiten el token "Mobile" — pantallas grandes → admin.
    expect(
      isPhoneUserAgent("Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36"),
    ).toBe(false);
  });

  it("NO trata iPad como teléfono (iPadOS manda UA de desktop)", () => {
    // Decisión de producto: pantalla iPad cabe en /admin.
    expect(
      isPhoneUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(false);
  });

  it("detecta Windows Phone (IEMobile)", () => {
    expect(
      isPhoneUserAgent(
        "Mozilla/5.0 (compatible; MSIE 9.0; Windows Phone OS 7.5; IEMobile/9.0)",
      ),
    ).toBe(true);
  });

  it("detecta BlackBerry", () => {
    expect(isPhoneUserAgent("Mozilla/5.0 (BlackBerry; U; BlackBerry 9900)")).toBe(true);
  });

  it("NO trata Mac desktop como teléfono", () => {
    expect(
      isPhoneUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      ),
    ).toBe(false);
  });

  it("NO trata Windows desktop como teléfono", () => {
    expect(
      isPhoneUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
    ).toBe(false);
  });

  it("tolera null / undefined / vacío", () => {
    expect(isPhoneUserAgent(null)).toBe(false);
    expect(isPhoneUserAgent(undefined)).toBe(false);
    expect(isPhoneUserAgent("")).toBe(false);
  });
});
