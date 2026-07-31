import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, formatDate, formatDateTime, formatTime } from "@/lib/datetime";

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
