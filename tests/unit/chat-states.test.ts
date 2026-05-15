import { describe, expect, it } from "vitest";
import {
  parseTimeOfDay,
  parseTimeRange,
  parseDaysOfWeek,
  parseDate,
  parseIssueKind,
  minutesToHHMM,
  isGlobalReset,
  isPanicKeyword,
} from "@/server/chat/states";

describe("parseTimeOfDay", () => {
  it("parses HH:MM", () => {
    expect(parseTimeOfDay("19:30")).toBe(19 * 60 + 30);
    expect(parseTimeOfDay("00:00")).toBe(0);
    expect(parseTimeOfDay("23:59")).toBe(23 * 60 + 59);
  });

  it("parses am/pm", () => {
    expect(parseTimeOfDay("7pm")).toBe(19 * 60);
    expect(parseTimeOfDay("7 PM")).toBe(19 * 60);
    expect(parseTimeOfDay("12am")).toBe(0);
    expect(parseTimeOfDay("12pm")).toBe(12 * 60);
  });

  it("special 'ahora' returns -1", () => {
    expect(parseTimeOfDay("ahora")).toBe(-1);
    expect(parseTimeOfDay("AHORA")).toBe(-1);
  });

  it("rejects invalid", () => {
    expect(parseTimeOfDay("25:00")).toBeNull();
    expect(parseTimeOfDay("xx:yy")).toBeNull();
    expect(parseTimeOfDay("")).toBeNull();
    expect(parseTimeOfDay("19:60")).toBeNull();
  });
});

describe("parseTimeRange", () => {
  it("parses HH:MM-HH:MM", () => {
    expect(parseTimeRange("08:00-12:00")).toEqual({ startMin: 480, endMin: 720 });
    expect(parseTimeRange("08:00 - 12:00")).toEqual({ startMin: 480, endMin: 720 });
    expect(parseTimeRange("08:00 a 12:00")).toEqual({ startMin: 480, endMin: 720 });
  });

  it("rejects reversed or equal ranges", () => {
    expect(parseTimeRange("12:00-08:00")).toBeNull();
    expect(parseTimeRange("12:00-12:00")).toBeNull();
  });
});

describe("parseDaysOfWeek", () => {
  it("parses a range", () => {
    expect(parseDaysOfWeek("lunes a viernes")).toEqual([1, 2, 3, 4, 5]);
    expect(parseDaysOfWeek("sábado a lunes")).toEqual([6, 0, 1]);
  });

  it("parses comma/y separated", () => {
    expect(parseDaysOfWeek("martes y jueves")).toEqual([2, 4]);
    expect(parseDaysOfWeek("lun, mié, vie")).toEqual([1, 3, 5]);
  });

  it("supports 'todos'", () => {
    expect(parseDaysOfWeek("todos")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseDaysOfWeek("todos los días")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("rejects garbage", () => {
    expect(parseDaysOfWeek("xyz")).toBeNull();
    expect(parseDaysOfWeek("")).toBeNull();
  });
});

describe("parseDate", () => {
  const now = new Date(2026, 4, 15); // 2026-05-15 (project current date)

  it("parses DD/MM with implicit year", () => {
    const d = parseDate("20/12", now)!;
    expect(d.getDate()).toBe(20);
    expect(d.getMonth()).toBe(11);
    expect(d.getFullYear()).toBe(2026);
  });

  it("parses DD/MM/YYYY", () => {
    const d = parseDate("05/01/2027", now)!;
    expect(d.getDate()).toBe(5);
    expect(d.getMonth()).toBe(0);
    expect(d.getFullYear()).toBe(2027);
  });

  it("supports 'hoy' and 'mañana'", () => {
    const hoy = parseDate("hoy", now)!;
    expect(hoy.getDate()).toBe(15);
    const manana = parseDate("mañana", now)!;
    expect(manana.getDate()).toBe(16);
  });

  it("rejects invalid", () => {
    expect(parseDate("32/01", now)).toBeNull();
    expect(parseDate("xx/yy", now)).toBeNull();
    expect(parseDate("31/02", now)).toBeNull();
  });
});

describe("parseIssueKind", () => {
  it("maps friendly inputs", () => {
    expect(parseIssueKind("a")).toBe("maintenance");
    expect(parseIssueKind("mantenimiento")).toBe("maintenance");
    expect(parseIssueKind("b")).toBe("noise");
    expect(parseIssueKind("ruido")).toBe("noise");
    expect(parseIssueKind("c")).toBe("suspicious");
    expect(parseIssueKind("sospechoso")).toBe("suspicious");
  });

  it("rejects unknown", () => {
    expect(parseIssueKind("x")).toBeNull();
    expect(parseIssueKind("")).toBeNull();
  });
});

describe("minutesToHHMM", () => {
  it("formats with padding", () => {
    expect(minutesToHHMM(0)).toBe("00:00");
    expect(minutesToHHMM(8 * 60 + 5)).toBe("08:05");
    expect(minutesToHHMM(23 * 60 + 59)).toBe("23:59");
  });
});

describe("global keywords", () => {
  it("isGlobalReset detects menu/volver/cancelar", () => {
    expect(isGlobalReset("menu")).toBe(true);
    expect(isGlobalReset("volver")).toBe(true);
    expect(isGlobalReset("cancelar")).toBe(true);
    expect(isGlobalReset("hola")).toBe(false);
  });

  it("isPanicKeyword detects emergency words", () => {
    expect(isPanicKeyword("emergencia")).toBe(true);
    expect(isPanicKeyword("ayuda")).toBe(true);
    expect(isPanicKeyword("auxilio")).toBe(true);
    expect(isPanicKeyword("urgente")).toBe(false);
  });
});
