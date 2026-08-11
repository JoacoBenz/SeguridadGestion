import { describe, expect, it } from "vitest";
import { onboardingState } from "@/lib/onboarding";

const EMPTY = { unitCount: 0, residentCount: 0, hasPin: false, packageCount: 0 };
const COMPLETE = { unitCount: 10, residentCount: 8, hasPin: true, packageCount: 3 };

describe("onboardingState", () => {
  it("edificio nuevo: todo pendiente y el checklist se muestra", () => {
    const s = onboardingState(EMPTY);
    expect(s.show).toBe(true);
    expect(s.doneCount).toBe(0);
    expect(s.steps.map((x) => x.key)).toEqual(["unidades", "residentes", "pin", "paquete"]);
  });

  it("marca cada paso según los datos", () => {
    const s = onboardingState({ ...EMPTY, unitCount: 5, residentCount: 2 });
    const done = Object.fromEntries(s.steps.map((x) => [x.key, x.done]));
    expect(done).toEqual({ unidades: true, residentes: true, pin: false, paquete: false });
    expect(s.doneCount).toBe(2);
  });

  it("edificio completo: el checklist se esconde", () => {
    expect(onboardingState(COMPLETE).show).toBe(false);
  });

  it("el PIN es opcional: sin PIN pero con todo lo demás, se esconde igual", () => {
    const s = onboardingState({ ...COMPLETE, hasPin: false });
    expect(s.show).toBe(false);
    expect(s.doneCount).toBe(3);
  });

  it("con PIN pero sin paquete de prueba, sigue mostrándose", () => {
    const s = onboardingState({ ...COMPLETE, packageCount: 0 });
    expect(s.show).toBe(true);
  });

  it("si el admin borra todo, reaparece (no hay estado guardado)", () => {
    expect(onboardingState({ ...COMPLETE, unitCount: 0, residentCount: 0 }).show).toBe(true);
  });
});
