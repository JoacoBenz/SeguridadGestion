import { prisma } from "@/lib/db";
import { getWhatsAppClient } from "@/lib/whatsapp/client";
import { recordAudit } from "@/lib/audit";
import { dispatch, type SideEffect } from "./dispatch";
import { type ChatState, MENU_TEXT } from "./states";
import { announceVisitor } from "@/server/visitors/announce";
import { createRecurringAuthorization } from "@/server/access/announce-recurring";
import { setVacation } from "@/server/access/set-vacation";
import { reportIssue } from "@/server/issues/report";
import { decideDoorPrompt } from "@/server/visitors/decide-door-prompt";

export interface InboundMessage {
  providerMessageId: string;
  from: string; // WhatsApp number, no '+'
  body: string;
  timestampSec: number;
}

// Entry point called from the webhook (fire-and-forget after 200 ack).
export async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  // Dedupe Meta retries — first writer wins.
  try {
    await prisma.inboundMessageDedupe.create({
      data: { providerMessageId: msg.providerMessageId },
    });
  } catch {
    return; // already processed
  }

  const phone = `+${msg.from}`;
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.tenantId) {
    await sendUnknownReply(phone);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const session = await tx.chatSession.upsert({
      where: { userId: user.id },
      create: {
        tenantId: user.tenantId!,
        userId: user.id,
        phone,
        state: "MENU",
        context: {},
        lastInboundAt: new Date(msg.timestampSec * 1000),
      },
      update: { lastInboundAt: new Date(msg.timestampSec * 1000) },
    });

    const state = session.state as ChatState;
    const context = (session.context ?? {}) as Record<string, unknown>;

    // Pre-fetch data for state branches that need lookups.
    const data = await prefetchData(user.tenantId!, user.id, state, msg.body);

    const result = dispatch({ state, context, text: msg.body, data });

    let reply = result.reply;
    if (reply === "__faq_list__") {
      reply = renderFaqList(data.faqEntries);
    } else if (reply === "__lostfound_list__") {
      reply = renderLostFoundList(data.lostFoundItems);
    } else if (reply === "__my_auths_list__") {
      reply = renderAuthsList(data.myAuthorizations);
    }

    await tx.chatSession.update({
      where: { userId: user.id },
      data: {
        state: result.nextState,
        context: result.nextContext as object,
        lastOutboundAt: new Date(),
      },
    });

    // Execute side effects after session is persisted.
    if (result.sideEffect) {
      try {
        await runSideEffect(result.sideEffect, user.tenantId!, user.id);
      } catch (err) {
        await recordAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "chat.side_effect_failed",
          entityType: "ChatSession",
          entityId: session.id,
          metadata: {
            sideEffectKind: result.sideEffect.kind,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    // Outbound reply.
    const whatsapp = getWhatsAppClient();
    await whatsapp.sendText({ to: phone, body: reply });
  }, { isolationLevel: "Serializable" });
}

async function prefetchData(tenantId: string, userId: string, state: ChatState, text: string) {
  const t = text.trim().toLowerCase();
  const wantsFaq = state === "MENU" && t === "6";
  const wantsLost = state === "MENU" && t === "7";
  const wantsMyAuths = state === "MENU" && t === "8";
  const inFaqPick = state === "AWAITING_FAQ_PICK";
  const inLostPick = state === "AWAITING_LOSTFOUND_PICK";

  const [faqEntries, lostFoundItems, myAuthorizations] = await Promise.all([
    wantsFaq || inFaqPick
      ? prisma.faqEntry.findMany({
          where: { tenantId },
          orderBy: { ordinal: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    wantsLost || inLostPick
      ? prisma.lostFoundItem.findMany({
          where: { tenantId, status: "lost" },
          orderBy: { foundAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    wantsMyAuths
      ? prisma.recurringAuthorization.findMany({
          where: {
            tenantId,
            status: "active",
            createdByUserId: userId,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return {
    faqEntries: faqEntries.map((e) => ({ id: e.id, question: e.question, answer: e.answer })),
    lostFoundItems: lostFoundItems.map((i) => ({
      id: i.id,
      description: i.description,
      foundLocation: i.foundLocation,
    })),
    myAuthorizations: myAuthorizations.map((a) => ({
      id: a.id,
      label: `${a.name} · ${a.startTime}–${a.endTime}`,
    })),
  };
}

function renderFaqList(entries: { question: string }[]): string {
  if (entries.length === 0) {
    return "Todavía no hay preguntas frecuentes cargadas. " + MENU_TEXT;
  }
  const lines = entries.map((e, i) => `${i + 1}. ${e.question}`);
  return ["📖 Consultas frecuentes:", ...lines, "", "Respondé con el número."].join("\n");
}

function renderLostFoundList(items: { description: string; foundLocation: string | null }[]): string {
  if (items.length === 0) {
    return "No hay objetos perdidos cargados ahora mismo. " + MENU_TEXT;
  }
  const lines = items.map((it, i) => `${i + 1}. ${it.description}${it.foundLocation ? ` — ${it.foundLocation}` : ""}`);
  return ["🔍 Objetos perdidos:", ...lines, "", "Respondé con el número."].join("\n");
}

function renderAuthsList(auths: { label: string }[]): string {
  if (auths.length === 0) {
    return "No tenés autorizaciones activas. " + MENU_TEXT;
  }
  const lines = auths.map((a, i) => `${i + 1}. ${a.label}`);
  return ["📋 Tus autorizaciones activas:", ...lines, "", MENU_TEXT].join("\n");
}

async function runSideEffect(effect: SideEffect, tenantId: string, userId: string): Promise<void> {
  switch (effect.kind) {
    case "create_visitor_event": {
      const membership = await prisma.unitResident.findFirst({
        where: { userId },
        select: { unitId: true },
      });
      if (!membership) return;
      await announceVisitor({
        tenantId,
        unitId: membership.unitId,
        requestedByUserId: userId,
        visitorName: effect.visitorName,
        expectedTime: effect.expectedTime,
        vehiclePlate: effect.vehiclePlate,
      });
      return;
    }
    case "create_recurring_auth": {
      const membership = await prisma.unitResident.findFirst({
        where: { userId },
        select: { unitId: true },
      });
      if (!membership) return;
      await createRecurringAuthorization({
        tenantId,
        unitId: membership.unitId,
        createdByUserId: userId,
        name: effect.name,
        daysOfWeek: effect.daysOfWeek,
        startTime: effect.startTime,
        endTime: effect.endTime,
      });
      return;
    }
    case "set_vacation":
      await setVacation({ userId, start: effect.start, end: effect.end });
      return;
    case "clear_vacation":
      await setVacation({ userId, start: null, end: null });
      return;
    case "create_issue":
      await reportIssue({
        tenantId,
        reporterUserId: userId,
        kind: effect.issueKind,
        body: effect.body,
        severity: effect.severity,
      });
      return;
    case "decide_door_prompt":
      await decideDoorPrompt({
        visitorEventId: effect.visitorEventId,
        decidedByUserId: userId,
        decision: effect.decision,
      });
      return;
  }
}

async function sendUnknownReply(phone: string): Promise<void> {
  const whatsapp = getWhatsAppClient();
  try {
    await whatsapp.sendText({
      to: phone,
      body: "Hola, no te tengo registrado. Pedile al encargado que te de de alta.",
    });
  } catch {
    // best-effort
  }
}
