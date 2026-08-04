import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  formatDate,
  formatDateTime,
  formatTime,
  startOfMonthInTimeZone,
} from "@/lib/datetime";

// 2026-07-30T13:52:24Z = 10:52 en Buenos Aires (UTC-3).
const UTC_1352 = new Date("2026-07-30T13:52:24Z");

describe("formateo de fechas", () => {
  it("formatTime usa la zona horaria, no la del server", () => {
    expect(formatTime(UTC_1352, DEFAULT_TIMEZONE)).toBe("10:52");
  });

  it("formatTime es 24h — 13:52 UTC no puede salir como 01:52", () => {
    const t = formatTime(UTC_1352, DEFAULT_TIMEZONE);
    expect(t).not.toMatch(/^01:/);
    expect(t).not.toMatch(/a\.?\s?m\.?|p\.?\s?m\.?/i);
  });

  it("formatDate usa dd/mm/aaaa", () => {
    expect(formatDate(UTC_1352, DEFAULT_TIMEZONE)).toBe("30/07/2026");
  });

  it("el default es Buenos Aires", () => {
    expect(formatTime(UTC_1352)).toBe(formatTime(UTC_1352, DEFAULT_TIMEZONE));
  });

  it("respeta otra zona horaria si el tenant la define", () => {
    // Madrid en julio es UTC+2 → 15:52.
    expect(formatTime(UTC_1352, "Europe/Madrid")).toBe("15:52");
  });

  it("cruza el día cuando la zona lo corre", () => {
    // 01:30 UTC = 22:30 del día anterior en Buenos Aires.
    const justAfterMidnightUtc = new Date("2026-07-30T01:30:00Z");
    expect(formatDate(justAfterMidnightUtc, DEFAULT_TIMEZONE)).toBe("29/07/2026");
    expect(formatTime(justAfterMidnightUtc, DEFAULT_TIMEZONE)).toBe("22:30");
  });

  it("formatDateTime combina ambos", () => {
    expect(formatDateTime(UTC_1352, DEFAULT_TIMEZONE)).toBe("30/07/2026 10:52");
  });
});

describe("startOfMonthInTimeZone", () => {
  it("arranca a medianoche local, no a medianoche UTC", () => {
    // 2026-08-05 12:00 UTC → el mes arrancó el 1/8 a las 00:00 ART, que en UTC
    // son las 03:00 del 1/8. Con `new Date(y, m, 1)` en un server UTC daba las
    // 00:00 UTC, o sea las 21:00 del 31/7 en Buenos Aires: tres horas de
    // paquetes contadas en el mes equivocado.
    const start = startOfMonthInTimeZone(new Date("2026-08-05T12:00:00Z"), DEFAULT_TIMEZONE);
    expect(start.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("usa el mes local, no el UTC, cerca del cambio de mes", () => {
    // 1 de agosto 01:00 UTC = 31 de julio 22:00 en Buenos Aires: todavía julio.
    const start = startOfMonthInTimeZone(new Date("2026-08-01T01:00:00Z"), DEFAULT_TIMEZONE);
    expect(formatDate(start, DEFAULT_TIMEZONE)).toBe("01/07/2026");
  });

  it("formatea como día 1 en la zona del edificio", () => {
    for (const iso of ["2026-01-15T00:00:00Z", "2026-06-30T23:59:00Z", "2026-12-01T02:00:00Z"]) {
      const start = startOfMonthInTimeZone(new Date(iso), DEFAULT_TIMEZONE);
      expect(formatDate(start, DEFAULT_TIMEZONE)).toMatch(/^01\//);
      expect(formatTime(start, DEFAULT_TIMEZONE)).toBe("00:00");
    }
  });

  it("respeta otra zona horaria", () => {
    // Madrid en agosto es UTC+2 → medianoche local = 22:00 UTC del 31/7.
    const start = startOfMonthInTimeZone(new Date("2026-08-05T12:00:00Z"), "Europe/Madrid");
    expect(start.toISOString()).toBe("2026-07-31T22:00:00.000Z");
  });
});
