import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks
const findUniqueUser = vi.fn();
const findFirstUnitResident = vi.fn();
const createIssue = vi.fn();
const findUniqueTenant = vi.fn();
const findManyUsers = vi.fn();
const createAudit = vi.fn();
const sendTemplate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => findUniqueUser(...a),
      findMany: (...a: unknown[]) => findManyUsers(...a),
    },
    unitResident: {
      findFirst: (...a: unknown[]) => findFirstUnitResident(...a),
    },
    issue: {
      create: (...a: unknown[]) => createIssue(...a),
    },
    tenant: {
      findUnique: (...a: unknown[]) => findUniqueTenant(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => createAudit(...a),
    },
  },
}));

vi.mock("@/lib/whatsapp/client", () => ({
  getWhatsAppClient: () => ({
    sendTemplate: (...a: unknown[]) => sendTemplate(...a),
    sendText: vi.fn(),
  }),
}));

const { reportIssue } = await import("@/server/issues/report");

beforeEach(() => {
  findUniqueUser.mockReset();
  findFirstUnitResident.mockReset();
  createIssue.mockReset();
  findUniqueTenant.mockReset();
  findManyUsers.mockReset();
  createAudit.mockReset();
  sendTemplate.mockReset();
  createIssue.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "i_1",
    ...data,
  }));
  createAudit.mockResolvedValue(undefined);
  sendTemplate.mockResolvedValue({ providerMessageId: "wamid.test" });
});

describe("reportIssue — panic auto-escalates", () => {
  it("kind=panic forces severity=critical even if caller passed something else", async () => {
    findUniqueUser.mockResolvedValueOnce({ id: "u_r", role: "resident" });
    findFirstUnitResident.mockResolvedValueOnce({ unitId: "unit_1" });
    findUniqueTenant.mockResolvedValueOnce({ name: "Moca 2" });
    findManyUsers.mockResolvedValueOnce([]); // no admins → no fanout

    await reportIssue({
      tenantId: "t_1",
      kind: "panic",
      body: "ayuda",
      reporterUserId: "u_r",
      severity: "low",
    });

    const dataPassed = (createIssue.mock.calls[0]![0] as { data: { severity: string } }).data;
    expect(dataPassed.severity).toBe("critical");
  });

  it("severity defaults to 'normal' for non-panic kinds", async () => {
    findUniqueUser.mockResolvedValueOnce({ id: "u_r", role: "resident" });
    findFirstUnitResident.mockResolvedValueOnce({ unitId: "unit_1" });

    await reportIssue({
      tenantId: "t_1",
      kind: "maintenance",
      body: "se rompió algo",
      reporterUserId: "u_r",
    });

    const dataPassed = (createIssue.mock.calls[0]![0] as { data: { severity: string } }).data;
    expect(dataPassed.severity).toBe("normal");
  });

  it("explicit severity is honored for non-panic kinds", async () => {
    findUniqueUser.mockResolvedValueOnce({ id: "u_g", role: "guard" });

    await reportIssue({
      tenantId: "t_1",
      kind: "suspicious",
      body: "persona merodeando",
      reporterUserId: "u_g",
      severity: "high",
    });

    const dataPassed = (createIssue.mock.calls[0]![0] as { data: { severity: string } }).data;
    expect(dataPassed.severity).toBe("high");
  });
});

describe("reportIssue — title is derived from body", () => {
  it("short body → title === body", async () => {
    findUniqueUser.mockResolvedValueOnce({ id: "u_g", role: "guard" });

    await reportIssue({
      tenantId: "t_1",
      kind: "incident",
      body: "Portón con falla",
      reporterUserId: "u_g",
    });

    const dataPassed = (createIssue.mock.calls[0]![0] as { data: { title: string } }).data;
    expect(dataPassed.title).toBe("Portón con falla");
  });

  it("long body → title is truncated to ≤ 80 chars with ellipsis", async () => {
    findUniqueUser.mockResolvedValueOnce({ id: "u_g", role: "guard" });
    const longBody = "Lorem ipsum ".repeat(20);

    await reportIssue({
      tenantId: "t_1",
      kind: "incident",
      body: longBody,
      reporterUserId: "u_g",
    });

    const dataPassed = (createIssue.mock.calls[0]![0] as { data: { title: string } }).data;
    expect(dataPassed.title.length).toBeLessThanOrEqual(80);
    expect(dataPassed.title.endsWith("…")).toBe(true);
  });
});

describe("reportIssue — critical issues fan out to admins", () => {
  it("notifies each admin with phone via incidente_aviso_v1 template", async () => {
    findUniqueUser.mockResolvedValueOnce({ id: "u_r", role: "resident" });
    findFirstUnitResident.mockResolvedValueOnce({ unitId: "unit_1" });
    findUniqueTenant.mockResolvedValueOnce({ name: "Moca 2" });
    findManyUsers.mockResolvedValueOnce([
      { id: "u_a1", name: "Admin Uno", phone: "+5491100000001" },
      { id: "u_a2", name: "Admin Dos", phone: "+5491100000002" },
      { id: "u_a3", name: "Admin Sin Tel", phone: null },
    ]);

    await reportIssue({
      tenantId: "t_1",
      kind: "panic",
      body: "Emergencia",
      reporterUserId: "u_r",
    });

    expect(sendTemplate).toHaveBeenCalledTimes(2); // admin sin teléfono se salta
    const firstCall = sendTemplate.mock.calls[0]![0] as { template: string; to: string };
    expect(firstCall.template).toBe("incidente_aviso_v1");
    expect(firstCall.to).toBe("+5491100000001");
  });

  it("non-critical issues do NOT fan out", async () => {
    findUniqueUser.mockResolvedValueOnce({ id: "u_g", role: "guard" });

    await reportIssue({
      tenantId: "t_1",
      kind: "maintenance",
      body: "Filtración",
      reporterUserId: "u_g",
    });

    expect(sendTemplate).not.toHaveBeenCalled();
  });
});
