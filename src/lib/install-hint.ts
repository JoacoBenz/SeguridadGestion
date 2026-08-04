// Detección de plataforma para el cartel de "agregar a inicio".
//
// Ninguna plataforma deja disparar la instalación desde código sin un service
// worker, y en iOS no se puede ni con él: Apple nunca expuso la API. Así que
// lo único posible es explicar el gesto, y para eso hay que saber cuál mostrar.
//
// Módulo puro: recibe el user agent en vez de leer `navigator`, así se testea.

export type InstallPlatform = "ios" | "android" | "other";

/**
 * @param userAgent  `navigator.userAgent`
 * @param maxTouchPoints `navigator.maxTouchPoints` — un iPad moderno se
 *   presenta como "Macintosh", y esto es lo único que lo distingue de una Mac.
 */
export function detectInstallPlatform(
  userAgent: string,
  maxTouchPoints = 0,
): InstallPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPadOS 13+ miente y dice "Macintosh"; una Mac de verdad no tiene touch.
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

/**
 * ¿Ya está corriendo como app instalada? En ese caso no hay nada que sugerir.
 *
 * `display-mode: standalone` es el estándar; `navigator.standalone` es el
 * propietario de iOS, que hasta hace poco no reportaba el otro.
 */
export function isStandalone(
  matchesStandalone: boolean,
  navigatorStandalone: boolean | undefined,
): boolean {
  return matchesStandalone || navigatorStandalone === true;
}

export const INSTALL_HINT_DISMISSED_KEY = "packito:install-hint-dismissed";
