import { describe, expect, it } from "vitest";
import {
  mapWebhookStatus,
  overwritableStatuses,
} from "@/lib/whatsapp/webhook-status";

describe("mapWebhookStatus", () => {
  it("mapea los estados conocidos de Meta", () => {
    expect(mapWebhookStatus("sent")).toBe("sent");
    expect(mapWebhookStatus("delivered")).toBe("delivered");
    expect(mapWebhookStatus("read")).toBe("read");
    expect(mapWebhookStatus("failed")).toBe("failed");
  });

  it("devuelve null para estados desconocidos en vez de adivinar", () => {
    expect(mapWebhookStatus("deleted")).toBeNull();
    expect(mapWebhookStatus("warning")).toBeNull();
    expect(mapWebhookStatus("")).toBeNull();
  });
});

describe("overwritableStatuses", () => {
  it("un sent solo pisa queued", () => {
    expect(overwritableStatuses("sent")).toEqual(["queued"]);
  });

  it("un delivered tardío no pisa read", () => {
    expect(overwritableStatuses("delivered")).not.toContain("read");
    expect(overwritableStatuses("delivered")).toEqual(["queued", "sent"]);
  });

  it("read pisa todo lo anterior pero no failed", () => {
    expect(overwritableStatuses("read")).toEqual(["queued", "sent", "delivered"]);
  });

  it("failed pisa estados en vuelo pero no read", () => {
    expect(overwritableStatuses("failed")).not.toContain("read");
    expect(overwritableStatuses("failed")).toEqual(["queued", "sent", "delivered"]);
  });
});
