import { beforeEach, describe, expect, it, vi } from "vitest";

const updateManyUser = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      updateMany: (...a: unknown[]) => updateManyUser(...a),
    },
  },
}));

const { clearExpiredVacationsForTenant } = await import(
  "@/server/access/clear-expired-vacations"
);

beforeEach(() => {
  updateManyUser.mockReset();
  updateManyUser.mockResolvedValue({ count: 0 });
});

describe("clearExpiredVacationsForTenant", () => {
  it("calls updateMany scoped to the tenant with vacationEnd < start-of-today", async () => {
    await clearExpiredVacationsForTenant("t_1");
    expect(updateManyUser).toHaveBeenCalledTimes(1);
    const arg = updateManyUser.mock.calls[0]![0] as {
      where: { tenantId: string; vacationEnd: { lt: Date } };
      data: { vacationStart: null; vacationEnd: null };
    };
    expect(arg.where.tenantId).toBe("t_1");
    expect(arg.data.vacationStart).toBeNull();
    expect(arg.data.vacationEnd).toBeNull();

    // Cutoff is midnight of today (hours/minutes/seconds zeroed).
    const cutoff = arg.where.vacationEnd.lt;
    expect(cutoff.getHours()).toBe(0);
    expect(cutoff.getMinutes()).toBe(0);
    expect(cutoff.getSeconds()).toBe(0);
    expect(cutoff.getMilliseconds()).toBe(0);
    const today = new Date();
    expect(cutoff.getFullYear()).toBe(today.getFullYear());
    expect(cutoff.getMonth()).toBe(today.getMonth());
    expect(cutoff.getDate()).toBe(today.getDate());
  });

  it("is a no-op when no rows match (idempotent across requests)", async () => {
    updateManyUser.mockResolvedValueOnce({ count: 0 });
    await expect(clearExpiredVacationsForTenant("t_1")).resolves.toBeUndefined();
    await expect(clearExpiredVacationsForTenant("t_1")).resolves.toBeUndefined();
    expect(updateManyUser).toHaveBeenCalledTimes(2);
  });
});
