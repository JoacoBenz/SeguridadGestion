import { describe, expect, it } from "vitest";
import { parseDaysOfWeek } from "@/lib/recurring/parse";

describe("parseDaysOfWeek", () => {
  it('"lunes a viernes" → [1,2,3,4,5]', () => {
    const r = parseDaysOfWeek("lunes a viernes");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([1, 2, 3, 4, 5]);
  });

  it('"L-V" → [1,2,3,4,5]', () => {
    const r = parseDaysOfWeek("L-V");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([1, 2, 3, 4, 5]);
  });

  it('"martes y jueves" → [2,4]', () => {
    const r = parseDaysOfWeek("martes y jueves");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([2, 4]);
  });

  it('"sábado y domingo" sin acento equivale a con acento', () => {
    const a = parseDaysOfWeek("sabado y domingo");
    const b = parseDaysOfWeek("sábado y domingo");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value).toEqual(b.value);
  });

  it("rango que cruza el fin de semana (viernes a lunes)", () => {
    const r = parseDaysOfWeek("viernes a lunes");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([0, 1, 5, 6]);
  });

  it("lista con comas", () => {
    const r = parseDaysOfWeek("lun, mié, vie");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([1, 3, 5]);
  });

  it("rechaza tokens inválidos", () => {
    const r = parseDaysOfWeek("xyz y jueves");
    expect(r.ok).toBe(false);
  });

  it("rechaza string vacío", () => {
    const r = parseDaysOfWeek("");
    expect(r.ok).toBe(false);
  });

  it("un solo día", () => {
    const r = parseDaysOfWeek("miércoles");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([3]);
  });

  it("dedup días repetidos", () => {
    const r = parseDaysOfWeek("lunes, lunes, lun");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([1]);
  });
});
