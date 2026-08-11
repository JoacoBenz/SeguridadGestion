import { describe, expect, it } from "vitest";
import { renderWelcomeEmail } from "@/lib/auth/welcome-email";

// El ejemplo es genérico a propósito: nada de nombres de personas reales en
// fixtures que después terminan copiados a la documentación.
const BASE = {
  tenantName: "Edificio Libertad",
  recipientEmail: "usuario@ejemplo.com",
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

  it("habla del acceso a PackItO, sin nombrar a quién lo dio", () => {
    const { text } = admin();
    expect(text).toContain("Ya tenés acceso a PackItO");
    expect(text).not.toContain("undefined");
  });

  it("el link deja el email precargado, así el primer acceso sale con un clic", () => {
    const { html, text } = admin();
    expect(html).toContain("/login?email=usuario%40ejemplo.com");
    expect(text).toContain("/login?email=usuario%40ejemplo.com");
  });

  it("el link NO dispara el envío por sí solo — los clientes de mail prefetchean", () => {
    // Si abrirlo mandara el mail, un escáner de Gmail quemaría el throttle de
    // links pendientes antes de que la persona haga clic.
    const { html } = admin();
    expect(html).not.toMatch(/\/api\/(auth\/signin|acceso|enviar)/);
  });

  it("el texto cambia según el rol", () => {
    expect(admin().text).toMatch(/administrar/);
    expect(admin().text).toMatch(/residentes/);
    expect(guard().text).toMatch(/seguridad/i);
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
