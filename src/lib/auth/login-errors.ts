// Traducción de los errores que pueden aterrizar en /login.
//
// `pages.error` de Auth.js apunta a /login, así que cuando un magic link falla
// el usuario vuelve con `?error=Verification` — y la página lo imprimía crudo.
// Ver la palabra "Verification" en pantalla no le dice a nadie que el link
// venció ni qué hacer al respecto.
//
// Módulo puro, sin dependencias de Next, para poder testearlo.

export interface LoginError {
  /** Qué pasó, en una línea. */
  title: string;
  /** Qué hacer al respecto. Vacío cuando no hay nada que el usuario pueda hacer. */
  action: string;
}

// Códigos que emite Auth.js v5 al redirigir a la página de error.
const AUTH_ERRORS: Record<string, LoginError> = {
  // El caso frecuente: el link venció (10 minutos) o ya se usó una vez.
  Verification: {
    title: "Ese link ya no sirve.",
    action:
      "Los links duran 10 minutos y se usan una sola vez. Pedí uno nuevo con tu email.",
  },
  // El proveedor de mail rechazó el envío.
  EmailSignin: {
    title: "No pudimos mandarte el link.",
    action: "Revisá que el email esté bien escrito y probá de nuevo.",
  },
  EmailCreateAccount: {
    title: "No pudimos crear tu acceso.",
    action: "Probá de nuevo en unos minutos.",
  },
  // Falta una credencial del server (AUTH_SECRET, RESEND_API_KEY, etc.).
  Configuration: {
    title: "Hay un problema de configuración del sistema.",
    action: "No es algo que puedas resolver desde acá: avisale al administrador.",
  },
  AccessDenied: {
    title: "Tu cuenta no tiene acceso.",
    action: "Pedile al administrador de tu edificio que te habilite.",
  },
  SessionRequired: {
    title: "Necesitás iniciar sesión para entrar ahí.",
    action: "Ingresá tu email y te mandamos un link.",
  },
  // Auth.js usa "Default" cuando no tiene nada más específico.
  Default: {
    title: "No pudimos completar el inicio de sesión.",
    action: "Probá de nuevo con tu email.",
  },
};

const GENERIC: LoginError = AUTH_ERRORS.Default!;

/**
 * Convierte el `?error=` de la URL en algo legible.
 *
 * Además de los códigos de Auth.js, la propia página de login redirige con
 * mensajes ya escritos en castellano ("Email inválido", "Demasiados
 * intentos…"). Esos pasan tal cual; lo que se filtra es cualquier código
 * desconocido, que sería una palabra suelta en inglés sin sentido para el
 * usuario.
 */
export function describeLoginError(raw: string | undefined): LoginError | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const known = AUTH_ERRORS[value];
  if (known) return known;

  // Un token CamelCase de una sola palabra es un código de Auth.js que no
  // mapeamos: mostrarlo sería filtrar un internal.
  if (/^[A-Za-z]+$/.test(value)) return GENERIC;

  return { title: value, action: "" };
}
