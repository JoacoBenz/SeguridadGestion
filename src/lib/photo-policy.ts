// Reglas de fotos de paquetes: si se piden, y cuánto se conservan.
//
// Viven en Tenant.settings (JSON) porque son por edificio y no ameritan
// columnas propias. Módulo puro y sin "use server" para poder testearlo.

export type PhotoMode = "required" | "optional" | "disabled";

export const PHOTO_MODES: readonly PhotoMode[] = ["required", "optional", "disabled"];

// Mantiene el comportamiento previo: con storage configurado la foto era
// obligatoria, sin excepción.
export const DEFAULT_PHOTO_MODE: PhotoMode = "required";

// Días que se conservan las fotos de paquetes ya cerrados. La foto sirve para
// resolver disputas ("ese paquete no llegó"), y esa ventana se cierra rápido:
// pasado ese plazo es sólo un dato personal guardado sin motivo (la etiqueta
// del envío suele mostrar nombre y dirección).
export const DEFAULT_PHOTO_RETENTION_DAYS = 60;

// 0 = no borrar nunca. Lo permitimos explícitamente para un edificio que
// necesite historial largo, pero no es el default.
export const RETENTION_DISABLED = 0;

const MAX_RETENTION_DAYS = 3650;

function settingsObject(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === "object"
    ? (settings as Record<string, unknown>)
    : {};
}

export function photoMode(settings: unknown): PhotoMode {
  const value = settingsObject(settings).photoMode;
  return PHOTO_MODES.includes(value as PhotoMode)
    ? (value as PhotoMode)
    : DEFAULT_PHOTO_MODE;
}

export function isPhotoMode(value: unknown): value is PhotoMode {
  return typeof value === "string" && PHOTO_MODES.includes(value as PhotoMode);
}

/**
 * Teléfono de la conserjería al que se manda una copia de la foto del paquete.
 *
 * Le deja al guardia el mismo mensaje que recibe el residente en su propio
 * WhatsApp, que termina siendo el archivo real: si mañana hay que buscar un
 * paquete de hace dos semanas, lo tiene en su chat sin depender del panel ni
 * de que la foto siga en el bucket. Vacío = no se manda copia.
 */
export function photoCopyPhone(settings: unknown): string | null {
  const value = settingsObject(settings).conserjeriaPhone;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * ¿Se borra la foto del bucket apenas se manda por WhatsApp?
 *
 * Con esto la foto vive segundos en el servidor: se sube, Meta la descarga al
 * armar el mensaje, y se borra. El archivo permanente pasa a ser el chat de
 * WhatsApp del residente y el de la conserjería, y nosotros no guardamos una
 * imagen que suele mostrar nombre y dirección en un bucket de lectura pública.
 *
 * Default activado. `photoRetentionDays` queda como red de seguridad para lo
 * que igual haya quedado (un envío fallido, o fotos previas a este cambio).
 */
export function isPhotoEphemeral(settings: unknown): boolean {
  const value = settingsObject(settings).photoEphemeral;
  return typeof value === "boolean" ? value : true;
}

export function photoRetentionDays(settings: unknown): number {
  const value = settingsObject(settings).photoRetentionDays;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PHOTO_RETENTION_DAYS;
  }
  if (value < 0) return DEFAULT_PHOTO_RETENTION_DAYS;
  return Math.min(Math.floor(value), MAX_RETENTION_DAYS);
}

/**
 * Fecha a partir de la cual una foto se considera vieja. Un paquete cerrado
 * antes de este instante ya puede perder su foto.
 *
 * Devuelve null si la retención está desactivada (0 días).
 */
export function photoRetentionCutoff(now: Date, days: number): Date | null {
  if (days <= RETENTION_DISABLED) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * ¿Se le muestra al guardia el campo de foto? Sólo si hay storage configurado
 * y el edificio no la deshabilitó. Sin bucket no hay dónde subirla.
 */
export function shouldShowPhotoField(
  storageConfigured: boolean,
  mode: PhotoMode,
): boolean {
  return storageConfigured && mode !== "disabled";
}

/** ¿El form rechaza el alta sin foto? */
export function isPhotoRequired(storageConfigured: boolean, mode: PhotoMode): boolean {
  return storageConfigured && mode === "required";
}
