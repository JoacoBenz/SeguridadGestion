// Política pura de recordatorios (sin DB, unit-testeable), separada del
// sender igual que pickup-token.ts respecto de pickup-actions.ts.
//
// Un paquete merece recordatorio si lleva >= REMINDER_AFTER_DAYS esperando
// y no se le mandó otro recordatorio en los últimos REMINDER_COOLDOWN_DAYS.

export const REMINDER_AFTER_DAYS = 3;
export const REMINDER_COOLDOWN_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function reminderCutoff(now: Date): Date {
  return new Date(now.getTime() - REMINDER_AFTER_DAYS * DAY_MS);
}

export function isReminderDue(
  receivedAt: Date,
  lastReminderAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (now.getTime() - receivedAt.getTime() < REMINDER_AFTER_DAYS * DAY_MS) {
    return false;
  }
  if (
    lastReminderAt !== null &&
    now.getTime() - lastReminderAt.getTime() < REMINDER_COOLDOWN_DAYS * DAY_MS
  ) {
    return false;
  }
  return true;
}
