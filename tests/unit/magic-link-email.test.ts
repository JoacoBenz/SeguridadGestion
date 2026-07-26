import { describe, expect, it } from "vitest";
import { renderMagicLinkEmail } from "@/lib/auth/magic-link-email";

const URL_WITH_QUERY =
  "https://packito.bexovar.com.ar/api/auth/callback/resend?callbackUrl=%2F&token=abc123&email=a%40b.com";

describe("renderMagicLinkEmail", () => {
  it("incluye el link escapado en el HTML (href y fallback)", () => {
    const { html } = renderMagicLinkEmail(URL_WITH_QUERY);
    const escaped = URL_WITH_QUERY.replace(/&/g, "&amp;");
    expect(html).toContain(`href="${escaped}"`);
    // El & crudo rompería el HTML del email; nunca debe aparecer sin escapar.
    expect(html).not.toContain("token=abc123&email");
  });

  it("la versión de texto plano lleva el link crudo", () => {
    const { text } = renderMagicLinkEmail(URL_WITH_QUERY);
    expect(text).toContain(URL_WITH_QUERY);
  });

  it("comunica el vencimiento y el remitente de marca", () => {
    const { html, subject } = renderMagicLinkEmail(URL_WITH_QUERY);
    expect(subject).toBe("Tu acceso a PackItO");
    expect(html).toContain("10 minutos");
    expect(html).toContain("BEXOVAR");
  });
});
