import { describe, expect, it } from "vitest";
import { describeLoginError } from "@/lib/auth/login-errors";

describe("describeLoginError — códigos de Auth.js", () => {
  it("el link vencido explica la duración y cómo seguir", () => {
    const e = describeLoginError("Verification")!;
    expect(e.title).toMatch(/ya no sirve/i);
    expect(e.action).toMatch(/10 minutos/);
    expect(e.action).toMatch(/nuevo/i);
  });

  it.each([
    "Verification",
    "EmailSignin",
    "EmailCreateAccount",
    "Configuration",
    "AccessDenied",
    "SessionRequired",
    "Default",
  ])("%s tiene mensaje propio en castellano", (code) => {
    const e = describeLoginError(code)!;
    expect(e.title).not.toBe(code);
    // Nada de códigos crudos filtrándose a la pantalla.
    expect(e.title).not.toMatch(/^[A-Za-z]+$/);
  });

  it("cada mensaje termina en punto y arranca en mayúscula", () => {
    for (const code of ["Verification", "EmailSignin", "Configuration", "AccessDenied"]) {
      const e = describeLoginError(code)!;
      expect(e.title[0]).toBe(e.title[0]!.toUpperCase());
      expect(e.title.endsWith(".")).toBe(true);
    }
  });
});

describe("describeLoginError — códigos desconocidos", () => {
  it("un código de Auth.js que no mapeamos cae en el genérico, no se muestra crudo", () => {
    // Auth.js tiene decenas de códigos (OAuth*, Callback*, etc.) que este
    // producto no puede producir hoy, pero podría con otro proveedor.
    for (const code of ["OAuthAccountNotLinked", "CallbackRouteError", "AdapterError"]) {
      const e = describeLoginError(code)!;
      expect(e.title).not.toContain(code);
      expect(e.title).toMatch(/no pudimos/i);
    }
  });
});

describe("describeLoginError — mensajes propios de la app", () => {
  it("los mensajes ya escritos en castellano pasan tal cual", () => {
    for (const msg of [
      "Email inválido",
      "Demasiados intentos. Esperá un minuto y probá de nuevo.",
      "Ya te mandamos varios links. Revisá tu casilla (y spam) o esperá unos minutos.",
      "No pudimos enviar el link. Probá de nuevo.",
    ]) {
      expect(describeLoginError(msg)).toEqual({ title: msg, action: "" });
    }
  });
});

describe("describeLoginError — texto arbitrario de la URL", () => {
  it("NUNCA refleja contenido de la URL en pantalla — sería un vector de phishing", () => {
    for (const crafted of [
      "Tu cuenta fue bloqueada. Llamá al 11-5555-0000 para desbloquearla.",
      "ATENCIÓN: transferí a este alias para reactivar el servicio",
      "<b>hola</b>",
      "Error: contactá a soporte@atacante.com",
    ]) {
      const e = describeLoginError(crafted)!;
      expect(e.title).not.toContain(crafted);
      expect(e.title).toMatch(/no pudimos/i);
    }
  });
});

describe("describeLoginError — sin error", () => {
  it("null cuando no hay nada que mostrar", () => {
    expect(describeLoginError(undefined)).toBeNull();
    expect(describeLoginError("")).toBeNull();
    expect(describeLoginError("   ")).toBeNull();
  });
});
