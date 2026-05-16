import {
  MENU_TEXT,
  type ChatState,
  isGlobalReset,
  isPanicKeyword,
  minutesToHHMM,
  parseDate,
  parseDaysOfWeek,
  parseIssueKind,
  parseTimeOfDay,
  parseTimeRange,
} from "./states";

// Side-effect descriptors. inbound.ts runs them after the reducer returns.
// Keeping the reducer pure means we can unit-test the whole state machine.
export type SideEffect =
  | { kind: "create_visitor_event"; visitorName: string; expectedTime: Date | null; vehiclePlate: string | null }
  | { kind: "create_recurring_auth"; name: string; daysOfWeek: number[]; startTime: string; endTime: string }
  | { kind: "set_vacation"; start: Date; end: Date }
  | { kind: "clear_vacation" }
  | { kind: "create_issue"; issueKind: "maintenance" | "noise" | "suspicious" | "panic"; body: string; severity: "normal" | "critical" }
  | { kind: "decide_door_prompt"; visitorEventId: string; decision: "confirmed" | "rejected" };

export interface DispatchInput {
  state: ChatState;
  context: Record<string, unknown>;
  text: string;
  // Read-only data inbound.ts pre-fetches when state suggests it.
  data?: {
    faqEntries?: { id: string; question: string; answer: string }[];
    lostFoundItems?: { id: string; description: string; foundLocation: string | null }[];
    myAuthorizations?: { id: string; label: string }[];
  };
}

export interface DispatchResult {
  nextState: ChatState;
  nextContext: Record<string, unknown>;
  reply: string;
  sideEffect?: SideEffect;
}

const GENERIC_HUH = "No entendí. Escribí `menu` para ver opciones.";

export function dispatch(input: DispatchInput): DispatchResult {
  const { state, context, text } = input;
  const raw = text.trim();
  const t = raw.toLowerCase();

  if (isGlobalReset(t)) {
    return { nextState: "MENU", nextContext: {}, reply: MENU_TEXT };
  }

  // Panic shortcut from any state except door-prompt (which is itself critical).
  if (state !== "AWAITING_DOOR_DECISION" && state !== "AWAITING_PANIC_CONFIRM" && isPanicKeyword(t)) {
    return {
      nextState: "AWAITING_PANIC_CONFIRM",
      nextContext: {},
      reply: "🚨 ¿Confirmás que es una emergencia? Respondé `sí` para avisar al encargado.",
    };
  }

  switch (state) {
    case "MENU":
      return handleMenu(t);

    case "AWAITING_VISITOR_NAME": {
      if (!raw) return same(state, context, "Decime el nombre de la persona.");
      return {
        nextState: "AWAITING_VISITOR_TIME",
        nextContext: { ...context, visitorName: raw },
        reply: "¿A qué hora viene? Ej: `19:30` o `ahora`.",
      };
    }

    case "AWAITING_VISITOR_TIME": {
      const min = parseTimeOfDay(t);
      if (min === null) return same(state, context, "No reconocí la hora. Ej: `19:30` o `ahora`.");
      const visitorName = String(context.visitorName ?? "");
      const expectedTime = min === -1 ? null : minutesFromTodayToDate(min);
      return {
        nextState: "AWAITING_VEHICLE_PLATE",
        nextContext: { ...context, expectedTime: expectedTime?.toISOString() ?? null },
        reply: `¿Viene en auto? Mandame la patente (ej: AB123CD) o respondé \`no\`.`,
      };
    }

    case "AWAITING_VEHICLE_PLATE": {
      const plate = t === "no" || t === "n" ? null : raw.toUpperCase();
      const visitorName = String(context.visitorName ?? "");
      const expectedTimeIso = context.expectedTime as string | null | undefined;
      const expectedTime = expectedTimeIso ? new Date(expectedTimeIso) : null;
      const when = expectedTime ? `hoy a las ${expectedTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "ahora";
      const plateLine = plate ? ` (patente ${plate})` : "";
      return {
        nextState: "AWAITING_VISITOR_CONFIRM",
        nextContext: { ...context, vehiclePlate: plate },
        reply: `Confirmá: ${visitorName} ${when}${plateLine}. Respondé \`sí\` o \`no\`.`,
      };
    }

    case "AWAITING_VISITOR_CONFIRM": {
      if (t !== "sí" && t !== "si" && t !== "s") {
        return { nextState: "MENU", nextContext: {}, reply: "Anulado. " + MENU_TEXT };
      }
      const visitorName = String(context.visitorName ?? "");
      const expectedTimeIso = context.expectedTime as string | null | undefined;
      const vehiclePlate = (context.vehiclePlate as string | null | undefined) ?? null;
      return {
        nextState: "MENU",
        nextContext: {},
        reply: "✅ Listo. Le aviso al conserje.",
        sideEffect: {
          kind: "create_visitor_event",
          visitorName,
          expectedTime: expectedTimeIso ? new Date(expectedTimeIso) : null,
          vehiclePlate,
        },
      };
    }

    case "AWAITING_DOOR_DECISION": {
      const visitorEventId = String(context.visitorEventId ?? "");
      if (!visitorEventId) {
        return { nextState: "MENU", nextContext: {}, reply: "Se venció la pregunta. " + MENU_TEXT };
      }
      if (t === "1" || t === "si" || t === "sí" || t === "s") {
        return {
          nextState: "MENU",
          nextContext: {},
          reply: "✅ Le doy paso.",
          sideEffect: { kind: "decide_door_prompt", visitorEventId, decision: "confirmed" },
        };
      }
      if (t === "2" || t === "no" || t === "n") {
        return {
          nextState: "MENU",
          nextContext: {},
          reply: "❌ Le digo que no podés recibirlo.",
          sideEffect: { kind: "decide_door_prompt", visitorEventId, decision: "rejected" },
        };
      }
      return same(state, context, "Respondé `1` (sí) o `2` (no).");
    }

    case "AWAITING_RECURRING_NAME": {
      if (!raw) return same(state, context, "Nombre de la persona o servicio.");
      return {
        nextState: "AWAITING_RECURRING_DAYS",
        nextContext: { ...context, recurringName: raw },
        reply: "¿Qué días? Ej: `lunes a viernes`, `martes y jueves`, `todos`.",
      };
    }

    case "AWAITING_RECURRING_DAYS": {
      const days = parseDaysOfWeek(t);
      if (!days) return same(state, context, "No te entendí los días. Ej: `lunes a viernes`.");
      return {
        nextState: "AWAITING_RECURRING_TIME",
        nextContext: { ...context, daysOfWeek: days },
        reply: "¿En qué horario? Ej: `08:00-12:00`.",
      };
    }

    case "AWAITING_RECURRING_TIME": {
      const range = parseTimeRange(t);
      if (!range) return same(state, context, "Necesito un rango, ej: `08:00-12:00`.");
      const name = String(context.recurringName ?? "");
      const days = (context.daysOfWeek as number[]) ?? [];
      return {
        nextState: "AWAITING_RECURRING_CONFIRM",
        nextContext: { ...context, startMin: range.startMin, endMin: range.endMin },
        reply: `Confirmá: ${name}, ${days.length} días, ${minutesToHHMM(range.startMin)}–${minutesToHHMM(range.endMin)}. \`sí\` / \`no\`.`,
      };
    }

    case "AWAITING_RECURRING_CONFIRM": {
      if (t !== "sí" && t !== "si" && t !== "s") {
        return { nextState: "MENU", nextContext: {}, reply: "Anulado. " + MENU_TEXT };
      }
      const name = String(context.recurringName ?? "");
      const daysOfWeek = (context.daysOfWeek as number[]) ?? [];
      const startMin = Number(context.startMin ?? 0);
      const endMin = Number(context.endMin ?? 0);
      return {
        nextState: "MENU",
        nextContext: {},
        reply: "✅ Autorización fija guardada.",
        sideEffect: {
          kind: "create_recurring_auth",
          name,
          daysOfWeek,
          startTime: minutesToHHMM(startMin),
          endTime: minutesToHHMM(endMin),
        },
      };
    }

    case "AWAITING_VACATION_START": {
      const d = parseDate(t);
      if (!d) return same(state, context, "Fecha inválida. Ej: `20/12` o `hoy`.");
      return {
        nextState: "AWAITING_VACATION_END",
        nextContext: { ...context, vacationStart: d.toISOString() },
        reply: "¿Hasta cuándo? Ej: `05/01`.",
      };
    }

    case "AWAITING_VACATION_END": {
      const d = parseDate(t);
      const startIso = context.vacationStart as string | undefined;
      const start = startIso ? new Date(startIso) : null;
      if (!d || !start || d <= start) {
        return same(state, context, "Fecha inválida o anterior al inicio.");
      }
      return {
        nextState: "AWAITING_VACATION_CONFIRM",
        nextContext: { ...context, vacationEnd: d.toISOString() },
        reply: `Confirmá vacaciones del ${start.toLocaleDateString("es-AR")} al ${d.toLocaleDateString("es-AR")}. \`sí\` / \`no\`.`,
      };
    }

    case "AWAITING_VACATION_CONFIRM": {
      if (t !== "sí" && t !== "si" && t !== "s") {
        return { nextState: "MENU", nextContext: {}, reply: "Anulado. " + MENU_TEXT };
      }
      const startIso = context.vacationStart as string;
      const endIso = context.vacationEnd as string;
      return {
        nextState: "MENU",
        nextContext: {},
        reply: "✅ Modo vacaciones activado. El conserje ve la nota.",
        sideEffect: { kind: "set_vacation", start: new Date(startIso), end: new Date(endIso) },
      };
    }

    case "AWAITING_ISSUE_KIND": {
      const kind = parseIssueKind(t);
      if (!kind) {
        return same(state, context, "Elegí: `a` mantenimiento · `b` ruido · `c` sospechoso.");
      }
      return {
        nextState: "AWAITING_ISSUE_BODY",
        nextContext: { ...context, issueKind: kind },
        reply: "Contame qué pasó (una frase corta).",
      };
    }

    case "AWAITING_ISSUE_BODY": {
      if (raw.length < 3) return same(state, context, "Hace falta una descripción más larga.");
      const kind = (context.issueKind as "maintenance" | "noise" | "suspicious") ?? "maintenance";
      return {
        nextState: "MENU",
        nextContext: {},
        reply: "✅ Reportado al admin.",
        sideEffect: { kind: "create_issue", issueKind: kind, body: raw, severity: "normal" },
      };
    }

    case "AWAITING_PANIC_CONFIRM": {
      if (t !== "sí" && t !== "si" && t !== "s") {
        return { nextState: "MENU", nextContext: {}, reply: "Aviso anulado. " + MENU_TEXT };
      }
      return {
        nextState: "MENU",
        nextContext: {},
        reply: "🚨 Aviso enviado. El encargado fue alertado.",
        sideEffect: { kind: "create_issue", issueKind: "panic", body: "Emergencia reportada desde WhatsApp.", severity: "critical" },
      };
    }

    case "AWAITING_FAQ_PICK": {
      const entries = input.data?.faqEntries ?? [];
      const n = Number(t);
      if (!Number.isInteger(n) || n < 1 || n > entries.length) {
        return same(state, context, "Elegí un número de la lista.");
      }
      const entry = entries[n - 1];
      if (!entry) return same(state, context, "Elegí un número de la lista.");
      return {
        nextState: "MENU",
        nextContext: {},
        reply: `${entry.question}\n\n${entry.answer}\n\n— ${MENU_TEXT}`,
      };
    }

    case "AWAITING_LOSTFOUND_PICK": {
      const items = input.data?.lostFoundItems ?? [];
      const n = Number(t);
      if (!Number.isInteger(n) || n < 1 || n > items.length) {
        return same(state, context, "Elegí un número de la lista.");
      }
      const item = items[n - 1];
      if (!item) return same(state, context, "Elegí un número de la lista.");
      const loc = item.foundLocation ? ` (${item.foundLocation})` : "";
      return {
        nextState: "MENU",
        nextContext: {},
        reply: `${item.description}${loc}. Pasá por conserjería para retirarlo.`,
      };
    }

    case "AWAITING_AUTHS_LIST_PICK":
      // For v1, this is informational only — listing happens in inbound.ts.
      return { nextState: "MENU", nextContext: {}, reply: MENU_TEXT };
  }
}

function handleMenu(t: string): DispatchResult {
  switch (t) {
    case "1":
      return {
        nextState: "AWAITING_VISITOR_NAME",
        nextContext: {},
        reply: "¿Nombre de quien viene?",
      };
    case "2":
      return {
        nextState: "AWAITING_RECURRING_NAME",
        nextContext: {},
        reply: "Nombre de la persona o servicio (ej: `Marcela (mucama)`).",
      };
    case "3":
      return {
        nextState: "AWAITING_VACATION_START",
        nextContext: {},
        reply: "¿Desde cuándo? Ej: `20/12` o `hoy`.",
      };
    case "4":
      return {
        nextState: "AWAITING_ISSUE_KIND",
        nextContext: {},
        reply: "¿Qué tipo? `a` mantenimiento · `b` ruido · `c` sospechoso.",
      };
    case "5":
      return {
        nextState: "AWAITING_PANIC_CONFIRM",
        nextContext: {},
        reply: "🚨 ¿Confirmás que es una emergencia? Respondé `sí` para avisar al encargado.",
      };
    case "6":
      // inbound.ts injects the list and transitions to AWAITING_FAQ_PICK.
      return {
        nextState: "AWAITING_FAQ_PICK",
        nextContext: { faqList: true },
        reply: "__faq_list__",
      };
    case "7":
      return {
        nextState: "AWAITING_LOSTFOUND_PICK",
        nextContext: { lostList: true },
        reply: "__lostfound_list__",
      };
    case "8":
      return {
        nextState: "MENU",
        nextContext: { myAuthsList: true },
        reply: "__my_auths_list__",
      };
    default:
      return { nextState: "MENU", nextContext: {}, reply: `${GENERIC_HUH}\n\n${MENU_TEXT}` };
  }
}

function same(state: ChatState, context: Record<string, unknown>, reply: string): DispatchResult {
  return { nextState: state, nextContext: context, reply };
}

function minutesFromTodayToDate(minutesOfDay: number): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Math.floor(minutesOfDay / 60),
    minutesOfDay % 60,
    0,
    0,
  );
}
