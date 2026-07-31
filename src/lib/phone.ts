// Normalización y validación de teléfonos para WhatsApp.
//
// Meta exige E.164 y, para móviles argentinos, el 9 después del código de país:
// +54 9 11 2388-5910 → +5491123885910. Un número sin el 9 existe como línea
// fija pero WhatsApp no entrega ahí, y el envío falla mucho después de la carga.
//
// El validador anterior aceptaba 7 a 15 dígitos y pegaba un "+" adelante, así
// que "1123885910" (formato nacional, sin código de país) se guardaba como
// "+1123885910" — un número de Estados Unidos. Se veía correcto en la lista de
// residentes y fallaba en silencio recién al mandar el mensaje.
//
// Módulo puro, sin "use server", para poder testearlo (mismo criterio que
// unit-label.ts y pickup-token.ts).

// El producto opera en Argentina: un número sin código de país se interpreta
// como argentino. Si algún día hay tenants de otro país, esto tiene que salir
// del tenant y no ser una constante.
const AR_COUNTRY_CODE = "54";

// NSN = national significant number: área + abonado, siempre 10 dígitos en AR
// (11 + 8 en CABA/GBA, 3+7 o 4+6 en el interior).
const AR_NSN_LENGTH = 10;

// E.164 de móvil argentino ya normalizado.
const AR_MOBILE_RE = /^\+549\d{10}$/;

// E.164 genérico para números de otros países.
const E164_RE = /^\+[1-9]\d{7,14}$/;

export type PhoneResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

function fail(error: string): PhoneResult {
  return { ok: false, error };
}

/**
 * Lleva un teléfono escrito de cualquier forma habitual a E.164.
 *
 * Acepta: `+54 9 11 2388-5910`, `011 15 2388-5910`, `11 2388 5910`,
 * `1123885910`, `(011) 4165-4591`. Rechaza con un mensaje concreto lo que no
 * puede resolver sin adivinar.
 */
export function normalizePhone(raw: string): PhoneResult {
  const trimmed = raw.trim();
  if (!trimmed) return fail("Falta el teléfono");

  // Separadores habituales al copiar de una agenda o una planilla.
  const cleaned = trimmed.replace(/[\s\-().]/g, "");
  const hadPlus = cleaned.startsWith("+");
  // 00 es el prefijo internacional en discado nacional: equivale al +.
  const withoutIntl = hadPlus ? cleaned.slice(1) : cleaned.replace(/^00/, "");
  const isIntl = hadPlus || cleaned.startsWith("00");

  if (!/^\d+$/.test(withoutIntl)) {
    return fail(`Teléfono inválido: "${trimmed}" — sólo números, con o sin +`);
  }

  // Número de otro país: se valida como E.164 genérico y se deja pasar.
  if (isIntl && !withoutIntl.startsWith(AR_COUNTRY_CODE)) {
    const candidate = `+${withoutIntl}`;
    return E164_RE.test(candidate)
      ? { ok: true, phone: candidate }
      : fail(`Teléfono inválido: "${trimmed}" — revisá el código de país`);
  }

  // A partir de acá es argentino. Sacamos el código de país si vino.
  let rest = withoutIntl;
  if (isIntl || looksCountryCoded(rest)) rest = rest.slice(AR_COUNTRY_CODE.length);
  // El 0 de discado nacional (011…) no va en E.164.
  rest = rest.replace(/^0/, "");
  // El 9 de móvil lo volvemos a agregar al final; acá lo sacamos para trabajar
  // siempre sobre el NSN.
  if (rest.length > AR_NSN_LENGTH && rest.startsWith("9")) rest = rest.slice(1);
  rest = stripMobilePrefix15(rest);

  if (rest.length < AR_NSN_LENGTH) {
    return fail(
      `Teléfono incompleto: "${trimmed}" — faltan dígitos (código de área + número, sin 0 ni 15)`,
    );
  }
  if (rest.length > AR_NSN_LENGTH) {
    return fail(
      `Teléfono demasiado largo: "${trimmed}" — tienen que ser ${AR_NSN_LENGTH} dígitos (código de área + número, sin 0 ni 15)`,
    );
  }

  const phone = `+${AR_COUNTRY_CODE}9${rest}`;
  return AR_MOBILE_RE.test(phone)
    ? { ok: true, phone }
    : fail(`Teléfono inválido: "${trimmed}"`);
}

/**
 * ¿Trae el código de país pegado, sin el +? Es como WhatsApp muestra los
 * números (5491133334444) y cómo suelen venir exportados de una agenda.
 *
 * No es ambiguo con un número nacional: ningún código de área argentino
 * empieza con 54 (son 11, o 2xx/3xx), así que un "54" al principio sólo puede
 * ser el país. Los largos válidos son 54+9+NSN (13) y 54+NSN sin el 9 (12).
 */
function looksCountryCoded(digits: string): boolean {
  if (!digits.startsWith(AR_COUNTRY_CODE)) return false;
  const withoutCountry = digits.length - AR_COUNTRY_CODE.length;
  return withoutCountry === AR_NSN_LENGTH || withoutCountry === AR_NSN_LENGTH + 1;
}

/**
 * Saca el 15 del discado nacional de celular (011 15 2388-5910). Va después del
 * código de área, que en Argentina puede tener 2, 3 o 4 dígitos — probamos las
 * tres posiciones y aceptamos la que deja un NSN de largo válido.
 */
function stripMobilePrefix15(nsn: string): string {
  if (nsn.length !== AR_NSN_LENGTH + 2) return nsn;
  for (const areaLength of [2, 3, 4]) {
    if (nsn.slice(areaLength, areaLength + 2) === "15") {
      return nsn.slice(0, areaLength) + nsn.slice(areaLength + 2);
    }
  }
  return nsn;
}

/**
 * ¿Está ya en el formato que Meta acepta?
 *
 * Un `+54…` tiene que cumplir la forma de móvil (con el 9): sin eso el E.164 es
 * sintácticamente válido pero WhatsApp no entrega. El E.164 genérico sólo
 * aplica a números de otros países.
 */
export function isWhatsAppReady(phone: string): boolean {
  if (phone.startsWith(`+${AR_COUNTRY_CODE}`)) return AR_MOBILE_RE.test(phone);
  return E164_RE.test(phone);
}
