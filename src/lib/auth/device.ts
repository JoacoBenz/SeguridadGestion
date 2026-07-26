import { createHmac, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Sesión de dispositivo para la conserjería compartida (una tablet en el mostrador,
// guardias que rotan). El admin fija un PIN por edificio; el guardia lo tipea una
// vez en el dispositivo y queda una cookie firmada de larga duración que
// getSession() reconoce como un guard de ese tenant.
//
// La cookie NO lleva PII: solo el tenantId + userId del guard sintético del
// dispositivo, firmada con HMAC(AUTH_SECRET) para que no se pueda forjar.

export const DEVICE_COOKIE = "pok_device";
const COOKIE_MAX_AGE_DAYS = 180;
export const DEVICE_COOKIE_MAX_AGE = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no configurado");
  return s;
}

// --- PIN hashing (scrypt, stdlib — sin bcrypt) ---

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, saltHex, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !expectedHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  const derived = scryptSync(pin, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// --- Cookie firmada ---

export interface DevicePayload {
  tenantId: string;
  userId: string;
  role: "guard";
  // Versión del PIN al momento del desbloqueo. Cambiar o borrar el PIN
  // bumpea la versión en Tenant.settings, revocando toda cookie anterior
  // (getSession la compara contra la DB). Sin esto, una tablet robada
  // seguiría desbloqueada 180 días aunque el admin cambie el PIN.
  v: number;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeDeviceCookie(payload: DevicePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeDeviceCookie(cookie: string | undefined): DevicePayload | null {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot < 0) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = sign(body);
  // Comparación en tiempo constante.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as DevicePayload;
    if (
      !payload.tenantId ||
      !payload.userId ||
      payload.role !== "guard" ||
      typeof payload.v !== "number"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
