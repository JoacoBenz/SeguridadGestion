import { describe, expect, it } from "vitest";
import { dispatch } from "@/server/chat/dispatch";

describe("dispatch — global resets", () => {
  it("`menu` from any state returns to MENU", () => {
    const r = dispatch({ state: "AWAITING_VISITOR_NAME", context: { x: 1 }, text: "menu" });
    expect(r.nextState).toBe("MENU");
    expect(r.nextContext).toEqual({});
  });

  it("`cancelar` resets to MENU", () => {
    const r = dispatch({ state: "AWAITING_RECURRING_DAYS", context: {}, text: "cancelar" });
    expect(r.nextState).toBe("MENU");
  });
});

describe("dispatch — visitor flow", () => {
  it("MENU + '1' → AWAITING_VISITOR_NAME", () => {
    const r = dispatch({ state: "MENU", context: {}, text: "1" });
    expect(r.nextState).toBe("AWAITING_VISITOR_NAME");
  });

  it("name → time → plate → confirm → side effect", () => {
    let s = dispatch({ state: "AWAITING_VISITOR_NAME", context: {}, text: "Juan Pérez" });
    expect(s.nextState).toBe("AWAITING_VISITOR_TIME");
    expect(s.nextContext.visitorName).toBe("Juan Pérez");

    s = dispatch({ state: "AWAITING_VISITOR_TIME", context: s.nextContext, text: "19:30" });
    expect(s.nextState).toBe("AWAITING_VEHICLE_PLATE");

    s = dispatch({ state: "AWAITING_VEHICLE_PLATE", context: s.nextContext, text: "AB123CD" });
    expect(s.nextState).toBe("AWAITING_VISITOR_CONFIRM");
    expect(s.nextContext.vehiclePlate).toBe("AB123CD");

    s = dispatch({ state: "AWAITING_VISITOR_CONFIRM", context: s.nextContext, text: "sí" });
    expect(s.nextState).toBe("MENU");
    expect(s.sideEffect).toBeDefined();
    expect(s.sideEffect?.kind).toBe("create_visitor_event");
    if (s.sideEffect?.kind === "create_visitor_event") {
      expect(s.sideEffect.visitorName).toBe("Juan Pérez");
      expect(s.sideEffect.vehiclePlate).toBe("AB123CD");
    }
  });

  it("'no' to plate question yields no plate", () => {
    const ctx = { visitorName: "Juan", expectedTime: null };
    const s = dispatch({ state: "AWAITING_VEHICLE_PLATE", context: ctx, text: "no" });
    expect(s.nextState).toBe("AWAITING_VISITOR_CONFIRM");
    expect(s.nextContext.vehiclePlate).toBeNull();
  });
});

describe("dispatch — recurring auth", () => {
  it("happy path produces create_recurring_auth side effect", () => {
    let s = dispatch({ state: "MENU", context: {}, text: "2" });
    expect(s.nextState).toBe("AWAITING_RECURRING_NAME");

    s = dispatch({ state: "AWAITING_RECURRING_NAME", context: {}, text: "Marcela" });
    expect(s.nextState).toBe("AWAITING_RECURRING_DAYS");

    s = dispatch({ state: "AWAITING_RECURRING_DAYS", context: s.nextContext, text: "lunes a viernes" });
    expect(s.nextState).toBe("AWAITING_RECURRING_TIME");
    expect(s.nextContext.daysOfWeek).toEqual([1, 2, 3, 4, 5]);

    s = dispatch({ state: "AWAITING_RECURRING_TIME", context: s.nextContext, text: "08:00-12:00" });
    expect(s.nextState).toBe("AWAITING_RECURRING_CONFIRM");

    s = dispatch({ state: "AWAITING_RECURRING_CONFIRM", context: s.nextContext, text: "sí" });
    expect(s.nextState).toBe("MENU");
    expect(s.sideEffect?.kind).toBe("create_recurring_auth");
    if (s.sideEffect?.kind === "create_recurring_auth") {
      expect(s.sideEffect.startTime).toBe("08:00");
      expect(s.sideEffect.endTime).toBe("12:00");
      expect(s.sideEffect.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    }
  });
});

describe("dispatch — panic", () => {
  it("global keyword 'emergencia' shortcuts to confirm", () => {
    const s = dispatch({ state: "AWAITING_VISITOR_NAME", context: {}, text: "emergencia" });
    expect(s.nextState).toBe("AWAITING_PANIC_CONFIRM");
  });

  it("MENU + 5 enters panic confirm", () => {
    const s = dispatch({ state: "MENU", context: {}, text: "5" });
    expect(s.nextState).toBe("AWAITING_PANIC_CONFIRM");
  });

  it("confirming yields critical issue side effect", () => {
    const s = dispatch({ state: "AWAITING_PANIC_CONFIRM", context: {}, text: "sí" });
    expect(s.nextState).toBe("MENU");
    expect(s.sideEffect?.kind).toBe("create_issue");
    if (s.sideEffect?.kind === "create_issue") {
      expect(s.sideEffect.issueKind).toBe("panic");
      expect(s.sideEffect.severity).toBe("critical");
    }
  });

  it("declining returns to menu with no side effect", () => {
    const s = dispatch({ state: "AWAITING_PANIC_CONFIRM", context: {}, text: "no" });
    expect(s.nextState).toBe("MENU");
    expect(s.sideEffect).toBeUndefined();
  });
});

describe("dispatch — issue flow", () => {
  it("MENU + 4 → kind picker", () => {
    const s = dispatch({ state: "MENU", context: {}, text: "4" });
    expect(s.nextState).toBe("AWAITING_ISSUE_KIND");
  });

  it("picks kind then body, emits side effect with severity=normal", () => {
    let s = dispatch({ state: "AWAITING_ISSUE_KIND", context: {}, text: "a" });
    expect(s.nextState).toBe("AWAITING_ISSUE_BODY");
    expect(s.nextContext.issueKind).toBe("maintenance");

    s = dispatch({ state: "AWAITING_ISSUE_BODY", context: s.nextContext, text: "Pérdida de agua en cocina" });
    expect(s.nextState).toBe("MENU");
    expect(s.sideEffect?.kind).toBe("create_issue");
    if (s.sideEffect?.kind === "create_issue") {
      expect(s.sideEffect.issueKind).toBe("maintenance");
      expect(s.sideEffect.severity).toBe("normal");
    }
  });
});

describe("dispatch — door prompt", () => {
  it("'1' confirms, '2' rejects", () => {
    const ctx = { visitorEventId: "evt_1" };
    let s = dispatch({ state: "AWAITING_DOOR_DECISION", context: ctx, text: "1" });
    expect(s.sideEffect?.kind).toBe("decide_door_prompt");
    if (s.sideEffect?.kind === "decide_door_prompt") {
      expect(s.sideEffect.decision).toBe("confirmed");
    }
    s = dispatch({ state: "AWAITING_DOOR_DECISION", context: ctx, text: "2" });
    expect(s.sideEffect?.kind).toBe("decide_door_prompt");
    if (s.sideEffect?.kind === "decide_door_prompt") {
      expect(s.sideEffect.decision).toBe("rejected");
    }
  });

  it("unknown input keeps state and asks again", () => {
    const s = dispatch({
      state: "AWAITING_DOOR_DECISION",
      context: { visitorEventId: "evt_1" },
      text: "tal vez",
    });
    expect(s.nextState).toBe("AWAITING_DOOR_DECISION");
    expect(s.sideEffect).toBeUndefined();
  });
});

describe("dispatch — FAQ", () => {
  it("MENU + 6 transitions to FAQ pick with sentinel reply", () => {
    const s = dispatch({ state: "MENU", context: {}, text: "6" });
    expect(s.nextState).toBe("AWAITING_FAQ_PICK");
    expect(s.reply).toBe("__faq_list__");
  });

  it("picking valid number returns answer", () => {
    const s = dispatch({
      state: "AWAITING_FAQ_PICK",
      context: {},
      text: "1",
      data: {
        faqEntries: [
          { id: "f1", question: "¿Cuándo?", answer: "Los martes." },
        ],
      },
    });
    expect(s.nextState).toBe("MENU");
    expect(s.reply).toContain("¿Cuándo?");
    expect(s.reply).toContain("Los martes.");
  });
});
