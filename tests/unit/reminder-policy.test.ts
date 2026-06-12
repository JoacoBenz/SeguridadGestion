import { describe, expect, it } from "vitest";
import {
  isReminderDue,
  reminderCutoff,
  REMINDER_AFTER_DAYS,
  REMINDER_COOLDOWN_DAYS,
} from "@/server/packages/reminder-policy";

const NOW = new Date("2026-06-12T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("isReminderDue", () => {
  it("no recuerda paquetes recientes", () => {
    const receivedAt = new Date(NOW.getTime() - (REMINDER_AFTER_DAYS - 1) * DAY);
    expect(isReminderDue(receivedAt, null, NOW)).toBe(false);
  });

  it("recuerda un paquete viejo sin recordatorios previos", () => {
    const receivedAt = new Date(NOW.getTime() - (REMINDER_AFTER_DAYS + 1) * DAY);
    expect(isReminderDue(receivedAt, null, NOW)).toBe(true);
  });

  it("respeta el cooldown si ya se recordó hace poco", () => {
    const receivedAt = new Date(NOW.getTime() - 10 * DAY);
    const lastReminderAt = new Date(NOW.getTime() - (REMINDER_COOLDOWN_DAYS - 1) * DAY);
    expect(isReminderDue(receivedAt, lastReminderAt, NOW)).toBe(false);
  });

  it("vuelve a recordar cuando pasó el cooldown", () => {
    const receivedAt = new Date(NOW.getTime() - 10 * DAY);
    const lastReminderAt = new Date(NOW.getTime() - (REMINDER_COOLDOWN_DAYS + 1) * DAY);
    expect(isReminderDue(receivedAt, lastReminderAt, NOW)).toBe(true);
  });

  it("el límite exacto de antigüedad cuenta como elegible", () => {
    const receivedAt = new Date(NOW.getTime() - REMINDER_AFTER_DAYS * DAY);
    expect(isReminderDue(receivedAt, null, NOW)).toBe(true);
  });
});

describe("reminderCutoff", () => {
  it("es REMINDER_AFTER_DAYS días atrás", () => {
    expect(reminderCutoff(NOW).getTime()).toBe(NOW.getTime() - REMINDER_AFTER_DAYS * DAY);
  });
});
