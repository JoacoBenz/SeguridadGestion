import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueUser = vi.fn();
const updateUser = vi.fn();
const createAudit = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => findUniqueUser(...a),
      update: (...a: unknown[]) => updateUser(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => createAudit(...a),
    },
  },
}));

const { setVacation } = await import("@/server/access/set-vacation");

beforeEach(() => {
  findUniqueUser.mockReset();
  updateUser.mockReset();
  createAudit.mockReset();
  findUniqueUser.mockResolvedValue({ id: "u_1", tenantId: "t_1" });
  updateUser.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "u_1",
    ...data,
  }));
  createAudit.mockResolvedValue(undefined);
});

describe("setVacation — input validation", () => {
  it("accepts a valid range and writes update + audit", async () => {
    const start = new Date("2026-12-20");
    const end = new Date("2027-01-05");
    await setVacation({ userId: "u_1", start, end });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: "u_1" },
      data: { vacationStart: start, vacationEnd: end },
    });
    const audit = (createAudit.mock.calls[0]![0] as { data: { action: string } }).data;
    expect(audit.action).toBe("user.vacation_set");
  });

  it("clears vacation when both start and end are null", async () => {
    await setVacation({ userId: "u_1", start: null, end: null });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: "u_1" },
      data: { vacationStart: null, vacationEnd: null },
    });
    const audit = (createAudit.mock.calls[0]![0] as { data: { action: string } }).data;
    expect(audit.action).toBe("user.vacation_cleared");
  });

  it("rejects end <= start with INVALID_VACATION_RANGE", async () => {
    const start = new Date("2026-12-20");
    const end = new Date("2026-12-15");
    await expect(setVacation({ userId: "u_1", start, end })).rejects.toThrow(
      "INVALID_VACATION_RANGE",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects start with no end with MISSING_VACATION_END", async () => {
    await expect(
      setVacation({ userId: "u_1", start: new Date(), end: null }),
    ).rejects.toThrow("MISSING_VACATION_END");
  });

  it("rejects end with no start with MISSING_VACATION_START", async () => {
    await expect(
      setVacation({ userId: "u_1", start: null, end: new Date() }),
    ).rejects.toThrow("MISSING_VACATION_START");
  });

  it("rejects unknown user with USER_NOT_FOUND", async () => {
    findUniqueUser.mockResolvedValueOnce(null);
    await expect(
      setVacation({ userId: "missing", start: null, end: null }),
    ).rejects.toThrow("USER_NOT_FOUND");
  });
});
