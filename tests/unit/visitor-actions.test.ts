import { beforeEach, describe, expect, it, vi } from "vitest";

const createVisitorEvent = vi.fn();
const findUniqueVisitorEvent = vi.fn();
const updateVisitorEvent = vi.fn();
const createAudit = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    visitorEvent: {
      create: (...a: unknown[]) => createVisitorEvent(...a),
      findUnique: (...a: unknown[]) => findUniqueVisitorEvent(...a),
      update: (...a: unknown[]) => updateVisitorEvent(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => createAudit(...a),
    },
  },
}));

const { announceVisitor } = await import("@/server/visitors/announce");
const { decideDoorPrompt } = await import("@/server/visitors/decide-door-prompt");

beforeEach(() => {
  createVisitorEvent.mockReset();
  findUniqueVisitorEvent.mockReset();
  updateVisitorEvent.mockReset();
  createAudit.mockReset();
  createVisitorEvent.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "v_1",
    ...data,
  }));
  updateVisitorEvent.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "v_1",
    ...data,
  }));
  createAudit.mockResolvedValue(undefined);
});

describe("announceVisitor", () => {
  it("creates VisitorEvent with kind=announced, status=confirmed", async () => {
    const expectedTime = new Date("2026-05-15T19:30:00");
    await announceVisitor({
      tenantId: "t_1",
      unitId: "u_1",
      requestedByUserId: "r_1",
      visitorName: "Juan Pérez",
      expectedTime,
      vehiclePlate: "AB123CD",
    });
    const data = (createVisitorEvent.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.kind).toBe("announced");
    expect(data.status).toBe("confirmed");
    expect(data.visitorName).toBe("Juan Pérez");
    expect(data.vehiclePlate).toBe("AB123CD");
    expect((data.expectedTime as Date).toISOString()).toBe(expectedTime.toISOString());
  });

  it("accepts null expectedTime and null plate", async () => {
    await announceVisitor({
      tenantId: "t_1",
      unitId: "u_1",
      requestedByUserId: "r_1",
      visitorName: "Sin hora",
      expectedTime: null,
      vehiclePlate: null,
    });
    const data = (createVisitorEvent.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.expectedTime).toBeUndefined();
    expect(data.vehiclePlate).toBeUndefined();
  });

  it("writes an audit entry per announcement", async () => {
    await announceVisitor({
      tenantId: "t_1",
      unitId: "u_1",
      requestedByUserId: "r_1",
      visitorName: "Anyone",
      expectedTime: null,
      vehiclePlate: null,
    });
    const audit = (createAudit.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(audit.action).toBe("visitor.announced");
    expect(audit.entityType).toBe("VisitorEvent");
  });
});

describe("decideDoorPrompt — first-write-wins", () => {
  it("updates pending door_prompt to confirmed", async () => {
    findUniqueVisitorEvent.mockResolvedValueOnce({
      id: "v_1",
      tenantId: "t_1",
      kind: "door_prompt",
      status: "pending",
    });
    const result = await decideDoorPrompt({
      visitorEventId: "v_1",
      decidedByUserId: "r_1",
      decision: "confirmed",
    });
    expect(result?.status).toBe("confirmed");
    expect(updateVisitorEvent).toHaveBeenCalled();
  });

  it("updates pending door_prompt to rejected", async () => {
    findUniqueVisitorEvent.mockResolvedValueOnce({
      id: "v_1",
      tenantId: "t_1",
      kind: "door_prompt",
      status: "pending",
    });
    const result = await decideDoorPrompt({
      visitorEventId: "v_1",
      decidedByUserId: "r_1",
      decision: "rejected",
    });
    expect(result?.status).toBe("rejected");
  });

  it("returns null when event does not exist", async () => {
    findUniqueVisitorEvent.mockResolvedValueOnce(null);
    const result = await decideDoorPrompt({
      visitorEventId: "missing",
      decidedByUserId: "r_1",
      decision: "confirmed",
    });
    expect(result).toBeNull();
    expect(updateVisitorEvent).not.toHaveBeenCalled();
  });

  it("does NOT update when event is already decided (idempotent)", async () => {
    const existing = {
      id: "v_1",
      tenantId: "t_1",
      kind: "door_prompt",
      status: "confirmed",
    };
    findUniqueVisitorEvent.mockResolvedValueOnce(existing);
    const result = await decideDoorPrompt({
      visitorEventId: "v_1",
      decidedByUserId: "r_2",
      decision: "rejected",
    });
    expect(result).toEqual(existing);
    expect(updateVisitorEvent).not.toHaveBeenCalled();
  });

  it("returns null when kind is not door_prompt (does not flip announcements)", async () => {
    findUniqueVisitorEvent.mockResolvedValueOnce({
      id: "v_1",
      tenantId: "t_1",
      kind: "announced",
      status: "confirmed",
    });
    const result = await decideDoorPrompt({
      visitorEventId: "v_1",
      decidedByUserId: "r_1",
      decision: "rejected",
    });
    expect(result).toBeNull();
    expect(updateVisitorEvent).not.toHaveBeenCalled();
  });
});
