import type { SubscriptionStatus } from "@prisma/client";

// Reglas puras del modelo de suscripción (sin DB, unit-testeables).
//
// Política: `suspended` y `trial` vencido bloquean SOLO el registro de
// paquetes nuevos. Los retiros y cancelaciones de paquetes ya pendientes
// siguen funcionando siempre — un residente nunca queda con su paquete
// rehén del estado comercial del consorcio.

export interface TenantSubscription {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
}

export type SubscriptionBlockReason = "SUSPENDED" | "TRIAL_EXPIRED";

export function subscriptionBlockReason(
  t: TenantSubscription,
  now: Date = new Date(),
): SubscriptionBlockReason | null {
  if (t.subscriptionStatus === "suspended") return "SUSPENDED";
  if (
    t.subscriptionStatus === "trial" &&
    t.trialEndsAt !== null &&
    t.trialEndsAt.getTime() <= now.getTime()
  ) {
    return "TRIAL_EXPIRED";
  }
  // active y past_due (período de gracia) operan normal; trial sin
  // vencimiento configurado también.
  return null;
}

export function isTenantOperational(
  t: TenantSubscription,
  now: Date = new Date(),
): boolean {
  return subscriptionBlockReason(t, now) === null;
}

// Días enteros de prueba restantes (redondeo hacia arriba: "vence hoy" = 0).
// null si el tenant no está en trial o no tiene vencimiento.
export function trialDaysLeft(
  t: TenantSubscription,
  now: Date = new Date(),
): number | null {
  if (t.subscriptionStatus !== "trial" || t.trialEndsAt === null) return null;
  const ms = t.trialEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export const TRIAL_DAYS = 14;

export function newTrialEnd(now: Date = new Date()): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}
