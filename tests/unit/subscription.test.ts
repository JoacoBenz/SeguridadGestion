import { describe, expect, it } from "vitest";
import {
  isTenantOperational,
  newTrialEnd,
  subscriptionBlockReason,
  trialDaysLeft,
  TRIAL_DAYS,
} from "@/lib/subscription";

const NOW = new Date("2026-06-12T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("subscriptionBlockReason / isTenantOperational", () => {
  it("active opera siempre", () => {
    const t = { subscriptionStatus: "active" as const, trialEndsAt: null };
    expect(subscriptionBlockReason(t, NOW)).toBeNull();
    expect(isTenantOperational(t, NOW)).toBe(true);
  });

  it("past_due opera (período de gracia)", () => {
    const t = { subscriptionStatus: "past_due" as const, trialEndsAt: null };
    expect(subscriptionBlockReason(t, NOW)).toBeNull();
  });

  it("suspended bloquea siempre, incluso con trial vigente", () => {
    const t = {
      subscriptionStatus: "suspended" as const,
      trialEndsAt: new Date(NOW.getTime() + 5 * DAY),
    };
    expect(subscriptionBlockReason(t, NOW)).toBe("SUSPENDED");
    expect(isTenantOperational(t, NOW)).toBe(false);
  });

  it("trial vigente opera", () => {
    const t = {
      subscriptionStatus: "trial" as const,
      trialEndsAt: new Date(NOW.getTime() + 1),
    };
    expect(subscriptionBlockReason(t, NOW)).toBeNull();
  });

  it("trial vencido bloquea (límite inclusive)", () => {
    const t = { subscriptionStatus: "trial" as const, trialEndsAt: NOW };
    expect(subscriptionBlockReason(t, NOW)).toBe("TRIAL_EXPIRED");
  });

  it("trial sin vencimiento configurado opera", () => {
    const t = { subscriptionStatus: "trial" as const, trialEndsAt: null };
    expect(subscriptionBlockReason(t, NOW)).toBeNull();
  });
});

describe("trialDaysLeft", () => {
  it("null fuera de trial", () => {
    expect(
      trialDaysLeft({ subscriptionStatus: "active", trialEndsAt: null }, NOW),
    ).toBeNull();
    expect(
      trialDaysLeft(
        { subscriptionStatus: "suspended", trialEndsAt: new Date(NOW.getTime() + DAY) },
        NOW,
      ),
    ).toBeNull();
  });

  it("redondea hacia arriba los días restantes", () => {
    const t = {
      subscriptionStatus: "trial" as const,
      trialEndsAt: new Date(NOW.getTime() + 2.5 * DAY),
    };
    expect(trialDaysLeft(t, NOW)).toBe(3);
  });

  it("nunca devuelve negativo", () => {
    const t = {
      subscriptionStatus: "trial" as const,
      trialEndsAt: new Date(NOW.getTime() - 10 * DAY),
    };
    expect(trialDaysLeft(t, NOW)).toBe(0);
  });
});

describe("newTrialEnd", () => {
  it("son TRIAL_DAYS días desde ahora", () => {
    expect(newTrialEnd(NOW).getTime()).toBe(NOW.getTime() + TRIAL_DAYS * DAY);
  });
});
