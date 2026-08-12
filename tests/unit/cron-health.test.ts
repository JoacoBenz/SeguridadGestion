import { describe, expect, it } from "vitest";
import { summarizeCronRuns, CRON_STALE_HOURS } from "@/server/superadmin/cron-health";

const NOW = new Date("2026-08-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

describe("summarizeCronRuns", () => {
  it("sin corridas: todos 'never' y sin alerta (recién deployado no es una emergencia)", () => {
    const s = summarizeCronRuns([], NOW);
    expect(s.jobs.map((j) => j.status)).toEqual(["never", "never"]);
    expect(s.attention).toBe(false);
  });

  it("corridas recientes ok: todo verde", () => {
    const s = summarizeCronRuns(
      [
        { entityId: "reminders", action: "cron.ok", at: hoursAgo(2) },
        { entityId: "photo-retention", action: "cron.ok", at: hoursAgo(10) },
      ],
      NOW,
    );
    expect(s.jobs.every((j) => j.status === "ok")).toBe(true);
    expect(s.attention).toBe(false);
  });

  it("una corrida más vieja que el umbral: stale y alerta", () => {
    const s = summarizeCronRuns(
      [
        { entityId: "reminders", action: "cron.ok", at: hoursAgo(CRON_STALE_HOURS + 1) },
        { entityId: "photo-retention", action: "cron.ok", at: hoursAgo(1) },
      ],
      NOW,
    );
    expect(s.jobs.find((j) => j.name === "reminders")?.status).toBe("stale");
    expect(s.attention).toBe(true);
  });

  it("última corrida con error: failed y alerta, aunque sea reciente", () => {
    const s = summarizeCronRuns(
      [
        { entityId: "reminders", action: "cron.failed", at: hoursAgo(1) },
        { entityId: "photo-retention", action: "cron.ok", at: hoursAgo(1) },
      ],
      NOW,
    );
    expect(s.jobs.find((j) => j.name === "reminders")?.status).toBe("failed");
    expect(s.attention).toBe(true);
  });

  it("usa la corrida MÁS RECIENTE de cada job (un fallo viejo ya superado no alerta)", () => {
    const s = summarizeCronRuns(
      [
        { entityId: "reminders", action: "cron.ok", at: hoursAgo(1) },
        { entityId: "reminders", action: "cron.failed", at: hoursAgo(25) },
        { entityId: "photo-retention", action: "cron.ok", at: hoursAgo(2) },
      ],
      NOW,
    );
    expect(s.jobs.find((j) => j.name === "reminders")?.status).toBe("ok");
    expect(s.attention).toBe(false);
  });

  it("stale gana sobre failed: si la última corrida es vieja, el problema es que no corre", () => {
    const s = summarizeCronRuns(
      [{ entityId: "reminders", action: "cron.failed", at: hoursAgo(CRON_STALE_HOURS + 5) }],
      NOW,
    );
    expect(s.jobs.find((j) => j.name === "reminders")?.status).toBe("stale");
  });
});
