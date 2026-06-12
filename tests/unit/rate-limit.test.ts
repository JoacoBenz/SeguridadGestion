import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, resetRateLimiter } from "@/lib/rate-limit";

beforeEach(() => {
  vi.useFakeTimers();
  resetRateLimiter();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("permite hasta el límite dentro de la ventana", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", { limit: 5, windowMs: 60_000 }).ok).toBe(true);
    }
    expect(rateLimit("k", { limit: 5, windowMs: 60_000 }).ok).toBe(false);
  });

  it("resetea cuando expira la ventana", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", { limit: 2, windowMs: 1_000 });
    expect(rateLimit("k", { limit: 2, windowMs: 1_000 }).ok).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(rateLimit("k", { limit: 2, windowMs: 1_000 }).ok).toBe(true);
  });

  it("las claves son independientes entre sí", () => {
    expect(rateLimit("a", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit("a", { limit: 1, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit("b", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });
});
