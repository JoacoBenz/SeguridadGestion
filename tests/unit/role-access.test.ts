import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetSessionResolver,
  setSessionResolver,
  type Session,
} from "@/lib/auth";

// Minimal Prisma stubs — enough to let server actions run past their auth
// boundary. If auth rejects, the action throws FORBIDDEN_ROLE before we hit
// these stubs at all.
const findFirstIssue = vi.fn();
const updateIssue = vi.fn();
const findFirstRecurring = vi.fn();
const updateRecurring = vi.fn();
const createAudit = vi.fn();
const findUniqueTenant = vi.fn();
const findManyUsers = vi.fn();
const createBroadcast = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    issue: {
      findFirst: (...a: unknown[]) => findFirstIssue(...a),
      update: (...a: unknown[]) => updateIssue(...a),
    },
    recurringAuthorization: {
      findFirst: (...a: unknown[]) => findFirstRecurring(...a),
      update: (...a: unknown[]) => updateRecurring(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => createAudit(...a),
    },
    tenant: {
      findUnique: (...a: unknown[]) => findUniqueTenant(...a),
    },
    user: {
      findMany: (...a: unknown[]) => findManyUsers(...a),
    },
    broadcast: {
      create: (...a: unknown[]) => createBroadcast(...a),
    },
  },
}));

// WhatsApp client stub — broadcast & critical issue alerts call it.
vi.mock("@/lib/whatsapp/client", () => ({
  getWhatsAppClient: () => ({
    sendTemplate: vi.fn(async () => ({ providerMessageId: "fake" })),
    sendText: vi.fn(async () => ({ providerMessageId: "fake" })),
  }),
}));

// Import AFTER mocks so the action modules pick them up.
const { acknowledgeIssue } = await import("@/server/issues/acknowledge");
const { resolveIssue } = await import("@/server/issues/resolve");
const {
  pauseRecurringAuthorization,
  revokeRecurringAuthorization,
} = await import("@/server/access/pause-recurring");
const { sendBroadcast } = await import("@/server/broadcasts/send");

const TENANT_ID = "t_libertad";

const guard: Session = { userId: "u_g", tenantId: TENANT_ID, role: "guard", name: "G" };
const admin: Session = { userId: "u_a", tenantId: TENANT_ID, role: "admin", name: "A" };
const resident: Session = {
  userId: "u_r",
  tenantId: TENANT_ID,
  role: "resident",
  name: "R",
};
const otherGuard: Session = {
  userId: "u_g2",
  tenantId: "t_other",
  role: "guard",
  name: "G2",
};

beforeEach(() => {
  findFirstIssue.mockReset();
  updateIssue.mockReset();
  findFirstRecurring.mockReset();
  updateRecurring.mockReset();
  createAudit.mockReset();
  findUniqueTenant.mockReset();
  findManyUsers.mockReset();
  createBroadcast.mockReset();
  findFirstIssue.mockResolvedValue(null);
  findFirstRecurring.mockResolvedValue(null);
  createAudit.mockResolvedValue(undefined);
  createBroadcast.mockResolvedValue({ id: "b_1" });
});

afterEach(() => resetSessionResolver());

describe("acknowledgeIssue — guard now allowed", () => {
  it("guard passes auth (then fails on missing issue, which is the next step)", async () => {
    setSessionResolver(async () => guard);
    await expect(
      acknowledgeIssue({ tenantId: TENANT_ID, issueId: "i_1" }),
    ).rejects.toThrow("ISSUE_NOT_FOUND");
  });

  it("admin passes auth", async () => {
    setSessionResolver(async () => admin);
    await expect(
      acknowledgeIssue({ tenantId: TENANT_ID, issueId: "i_1" }),
    ).rejects.toThrow("ISSUE_NOT_FOUND");
  });

  it("resident rejected with FORBIDDEN_ROLE", async () => {
    setSessionResolver(async () => resident);
    await expect(
      acknowledgeIssue({ tenantId: TENANT_ID, issueId: "i_1" }),
    ).rejects.toThrow("FORBIDDEN_ROLE");
  });

  it("guard from another tenant rejected with FORBIDDEN_TENANT", async () => {
    setSessionResolver(async () => otherGuard);
    await expect(
      acknowledgeIssue({ tenantId: TENANT_ID, issueId: "i_1" }),
    ).rejects.toThrow("FORBIDDEN_TENANT");
  });
});

describe("resolveIssue — guard now allowed", () => {
  it("guard passes auth", async () => {
    setSessionResolver(async () => guard);
    await expect(
      resolveIssue({ tenantId: TENANT_ID, issueId: "i_1", note: "ok" }),
    ).rejects.toThrow("ISSUE_NOT_FOUND");
  });

  it("resident rejected", async () => {
    setSessionResolver(async () => resident);
    await expect(
      resolveIssue({ tenantId: TENANT_ID, issueId: "i_1", note: "ok" }),
    ).rejects.toThrow("FORBIDDEN_ROLE");
  });
});

describe("pauseRecurringAuthorization / revoke — guard now allowed", () => {
  it("guard passes auth on pause", async () => {
    setSessionResolver(async () => guard);
    await expect(
      pauseRecurringAuthorization({
        tenantId: TENANT_ID,
        authorizationId: "a_1",
      }),
    ).rejects.toThrow("RECURRING_AUTH_NOT_FOUND");
  });

  it("guard passes auth on revoke", async () => {
    setSessionResolver(async () => guard);
    await expect(
      revokeRecurringAuthorization({
        tenantId: TENANT_ID,
        authorizationId: "a_1",
      }),
    ).rejects.toThrow("RECURRING_AUTH_NOT_FOUND");
  });

  it("resident rejected on pause", async () => {
    setSessionResolver(async () => resident);
    await expect(
      pauseRecurringAuthorization({
        tenantId: TENANT_ID,
        authorizationId: "a_1",
      }),
    ).rejects.toThrow("FORBIDDEN_ROLE");
  });
});

describe("sendBroadcast — still admin only", () => {
  it("guard rejected with FORBIDDEN_ROLE", async () => {
    setSessionResolver(async () => guard);
    await expect(
      sendBroadcast({
        tenantId: TENANT_ID,
        subject: "Test",
        body: "Test body",
      }),
    ).rejects.toThrow("FORBIDDEN_ROLE");
  });

  it("admin passes auth (then proceeds to fan-out path)", async () => {
    setSessionResolver(async () => admin);
    findUniqueTenant.mockResolvedValueOnce({ name: "Moca 2" });
    findManyUsers.mockResolvedValueOnce([]); // no residents → no fanout, returns OK
    const result = await sendBroadcast({
      tenantId: TENANT_ID,
      subject: "Test",
      body: "Test body",
    });
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });
});
