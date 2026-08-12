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
  it("permite hasta el límite dentro de la ventana", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await rateLimit("k", { limit: 5, windowMs: 60_000 })).ok).toBe(true);
    }
    expect((await rateLimit("k", { limit: 5, windowMs: 60_000 })).ok).toBe(false);
  });

  it("resetea cuando expira la ventana", async () => {
    for (let i = 0; i < 3; i++) await rateLimit("k", { limit: 2, windowMs: 1_000 });
    expect((await rateLimit("k", { limit: 2, windowMs: 1_000 })).ok).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect((await rateLimit("k", { limit: 2, windowMs: 1_000 })).ok).toBe(true);
  });

  it("las claves son independientes entre sí", async () => {
    expect((await rateLimit("a", { limit: 1, windowMs: 60_000 })).ok).toBe(true);
    expect((await rateLimit("a", { limit: 1, windowMs: 60_000 })).ok).toBe(false);
    expect((await rateLimit("b", { limit: 1, windowMs: 60_000 })).ok).toBe(true);
  });
});

// --- Backend Upstash (fetch stubeado — no hace falta cuenta) ----------------

describe("rateLimit con Upstash", () => {
  const ENV_URL = "https://fake.upstash.io";

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = ENV_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.unstubAllGlobals();
  });

  it("bloquea cuando el contador compartido supera el límite", async () => {
    let count = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        count += 1;
        return new Response(JSON.stringify([{ result: count }, { result: 1 }]), {
          status: 200,
        });
      }),
    );
    expect((await rateLimit("k", { limit: 2, windowMs: 60_000 })).ok).toBe(true);
    expect((await rateLimit("k", { limit: 2, windowMs: 60_000 })).ok).toBe(true);
    expect((await rateLimit("k", { limit: 2, windowMs: 60_000 })).ok).toBe(false);
  });

  it("manda INCR y PEXPIRE sobre una clave con ventana", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    await rateLimit("qr:1.2.3.4", { limit: 30, windowMs: 60_000 });
    const [url, init] = fetchSpy.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe(`${ENV_URL}/pipeline`);
    const body = JSON.parse(init.body as string) as string[][];
    expect(body[0]![0]).toBe("INCR");
    expect(body[0]![1]).toMatch(/^rl:qr:1\.2\.3\.4:\d+$/);
    expect(body[1]![0]).toBe("PEXPIRE");
  });

  it("si Upstash falla, deja pasar (fail-open)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    expect((await rateLimit("k", { limit: 1, windowMs: 60_000 })).ok).toBe(true);
    expect((await rateLimit("k", { limit: 1, windowMs: 60_000 })).ok).toBe(true);
  });
});
