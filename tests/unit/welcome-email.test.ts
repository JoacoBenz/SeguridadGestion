import { describe, expect, it } from "vitest";
import { renderWelcomeEmail } from "@/lib/auth/welcome-email";

// El ejemplo es genérico a propósito: nada de nombres de personas reales en
// fixtures que después terminan copiados a la documentación.
const BASE = {
  tenantName: "Edificio Libertad",
  recipientEmail: "usuario@ejemplo.com",
  invitedByName: "Joaco",
} as const;

const admin = () => renderWelcomeEmail({ ...BASE, role: "admin" });
const guard = () => renderWelcomeEmail({ ...BASE, role: "guard" });

describe("mail de bienvenida", () => {
  it("el asunto nombra el edificio, para que no parezca spam", () => {
    expect(admin().subject).toBe("Tu acceso a PackItO — Edificio Libertad");
  });

  it("NO lleva magic link: los links viven 10 minutos y este mail se lee tarde", () => {
    const { html, text } = admin();
    // Un token de verificación aterrizaría en esta ruta.
    expect(html).not.toContain("/api/auth/callback");
    expect(text).not.toContain("/api/auth/callback");
    expect(html).not.toMatch(/token=/);
  });

  it("manda a /login, donde la persona pide su propio link", () => {
    const { html, text } = admin();
    expect(html).toContain("/login");
    expect(text).toContain("/login");
  });

  it("dice con qué email hay que entrar — es el usuario", () => {
    const { html, text } = admin();
    expect(html).toContain("usuario@ejemplo.com");
    expect(text).toContain("usuario@ejemplo.com");
  });

  it("dice quién dio el acceso", () => {
    expect(admin().text).toContain("Joaco");
  });

  it("funciona sin saber quién invitó", () => {
    const sinInvitador = renderWelcomeEmail({
      tenantName: "Edificio Libertad",
      recipientEmail: "usuario@ejemplo.com",
      role: "admin",
    });
    expect(sinInvitador.text).toContain("Te dieron acceso");
    expect(sinInvitador.text).not.toContain("undefined");
  });

  it("el texto cambia según el rol", () => {
    expect(admin().text).toMatch(/administrar/);
    expect(admin().text).toMatch(/residentes/);
    expect(guard().text).toMatch(/conserjer/i);
    expect(guard().text).toMatch(/retiros/);
  });

  it("aclara que no hay contraseña", () => {
    expect(admin().text).toMatch(/contraseña/i);
  });

  it("escapa el HTML del nombre del edificio", () => {
    const malicioso = renderWelcomeEmail({
      tenantName: '<script>alert(1)</script>',
      recipientEmail: "usuario@ejemplo.com",
      role: "admin",
    });
    expect(malicioso.html).not.toContain("<script>");
    expect(malicioso.html).toContain("&lt;script&gt;");
  });

  it("la versión de texto plano no arrastra HTML", () => {
    expect(admin().text).not.toMatch(/<[a-z]/i);
  });
});
