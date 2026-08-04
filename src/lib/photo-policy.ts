// Reglas de fotos de paquetes. Son del sistema, no configurables por edificio:
// la foto es parte de cómo funciona el producto (el residente la recibe junto
// al aviso) y la ventana de retención es una decisión de privacidad que no
// tiene sentido delegar en cada administrador.
//
// Módulo puro y sin "use server" para poder testearlo.

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

/**
 * Teléfono de la conserjería al que se manda una copia de la foto del paquete.
 *
 * Es un dato del edificio, no una política: sólo el administrador sabe cuál es
 * el teléfono del mostrador. Vacío = no se manda copia.
 */
export function photoCopyPhone(settings: unknown): string | null {
  const value = settingsObject(settings).conserjeriaPhone;
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
 * ¿Se le pide la foto al guardia? Sólo depende de que haya un bucket donde
 * subirla; si no está configurado, el campo no se muestra y el alta sigue
 * funcionando.
 */
export function isPhotoRequired(storageConfigured: boolean): boolean {
  return storageConfigured;
}
