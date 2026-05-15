import { describe, expect, it } from "vitest";
import { parseTimeRange } from "@/lib/recurring/parse";

describe("parseTimeRange", () => {
  it('"08:00-12:00"', () => {
    const r = parseTimeRange("08:00-12:00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ start: "08:00", end: "12:00" });
  });

  it('"8 a 12"', () => {
    const r = parseTimeRange("8 a 12");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ start: "08:00", end: "12:00" });
  });

  it('"8 a 12hs"', () => {
    const r = parseTimeRange("8 a 12hs");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ start: "08:00", end: "12:00" });
  });

  it('"14:30 - 17:45"', () => {
    const r = parseTimeRange("14:30 - 17:45");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ start: "14:30", end: "17:45" });
  });

  it("rechaza inicio >= fin", () => {
    const r = parseTimeRange("12 a 12");
    expect(r.ok).toBe(false);
    const r2 = parseTimeRange("18 a 9");
    expect(r2.ok).toBe(false);
  });

  it("rechaza horas fuera de rango", () => {
    expect(parseTimeRange("25:00-26:00").ok).toBe(false);
    expect(parseTimeRange("8:75-9:00").ok).toBe(false);
  });

  it("rechaza input sin separador", () => {
    expect(parseTimeRange("8 12").ok).toBe(false);
    expect(parseTimeRange("").ok).toBe(false);
  });
});
