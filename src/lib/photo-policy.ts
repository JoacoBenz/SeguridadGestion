// Reglas de fotos de paquetes.
//
// Lo que el edificio decide: si al registrar un paquete la foto es obligatoria,
// opcional o no se pide, y a qué teléfono del mostrador mandarle copia.
//
// Lo que decide el sistema y NO se expone como opción: cuánto se conservan
// (`PHOTO_RETENTION_DAYS`). Es una decisión de privacidad, no una preferencia
// operativa, y dejarla en manos de cada administrador sólo genera edificios
// guardando fotos de etiquetas para siempre.
//
// Módulo puro y sin "use server" para poder testearlo.

export type PhotoMode = "required" | "optional" | "disabled";

export const PHOTO_MODES: readonly PhotoMode[] = ["required", "optional", "disabled"];

export const DEFAULT_PHOTO_MODE: PhotoMode = "required";

/**
 * Días que se conserva la foto de un paquete ya cerrado.
 *
 * Se guarda para que el admin pueda verla en el historial de Paquetes —
 * resolver un "ese paquete nunca llegó" es justamente para lo que sirve — pero
 * no más allá de esa ventana: la etiqueta del envío suele mostrar nombre y
 * dirección del residente, y el bucket es de lectura pública.
 */
export const PHOTO_RETENTION_DAYS = 30;

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

/**
 * Teléfono de la seguridad al que se manda una copia de la foto del paquete.
 * Vacío = no se manda copia.
 */
export function photoCopyPhone(settings: unknown): string | null {
  const value = settingsObject(settings).seguridadPhone;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Fecha a partir de la cual una foto se considera vencida. Un paquete cerrado
 * antes de este instante ya puede perder su foto.
 */
export function photoRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
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
