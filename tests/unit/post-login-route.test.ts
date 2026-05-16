import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth";

const headersMock = vi.fn();
const tenantFindUnique = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({ get: headersMock }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    tenant: { findUnique: (...args: unknown[]) => tenantFindUnique(...args) },
  },
}));

// Import AFTER mocks are wired so the helper picks them up.
const { postLoginRoute } = await import("@/lib/post-login-route");

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0";

const baseSession: Session = {
  userId: "u_1",
  tenantId: "t_libertad",
  role: "admin",
  name: "Admin",
};

beforeEach(() => {
  headersMock.mockReset();
  tenantFindUnique.mockReset();
  tenantFindUnique.mockResolvedValue({ slug: "edificio-libertad" });
});

describe("postLoginRoute", () => {
  it("superadmin → /superadmin (ignora device)", async () => {
    headersMock.mockReturnValue(IPHONE_UA);
    const route = await postLoginRoute({
      ...baseSession,
      role: "superadmin",
      tenantId: null,
    });
    expect(route).toBe("/superadmin");
    expect(tenantFindUnique).not.toHaveBeenCalled();
  });

  it("usuario sin tenant → /sin-edificio", async () => {
    headersMock.mockReturnValue(DESKTOP_UA);
    const route = await postLoginRoute({
      ...baseSession,
      role: "resident",
      tenantId: null,
    });
    expect(route).toBe("/sin-edificio");
  });

  it("tenant fantasma (no resuelve slug) → /sin-edificio", async () => {
    tenantFindUnique.mockResolvedValueOnce(null);
    headersMock.mockReturnValue(DESKTOP_UA);
    const route = await postLoginRoute(baseSession);
    expect(route).toBe("/sin-edificio");
  });

  it("admin en celular → /<slug>/conserjeria", async () => {
    headersMock.mockReturnValue(IPHONE_UA);
    const route = await postLoginRoute(baseSession);
    expect(route).toBe("/edificio-libertad/conserjeria");
  });

  it("admin en desktop → /<slug>/admin", async () => {
    headersMock.mockReturnValue(DESKTOP_UA);
    const route = await postLoginRoute(baseSession);
    expect(route).toBe("/edificio-libertad/admin");
  });

  it("admin sin User-Agent (null) cae en desktop → /<slug>/admin", async () => {
    headersMock.mockReturnValue(null);
    const route = await postLoginRoute(baseSession);
    expect(route).toBe("/edificio-libertad/admin");
  });

  it("guard en celular → /<slug>/conserjeria", async () => {
    headersMock.mockReturnValue(IPHONE_UA);
    const route = await postLoginRoute({ ...baseSession, role: "guard" });
    expect(route).toBe("/edificio-libertad/conserjeria");
  });

  it("guard en desktop también → /<slug>/conserjeria (no tiene admin)", async () => {
    headersMock.mockReturnValue(DESKTOP_UA);
    const route = await postLoginRoute({ ...baseSession, role: "guard" });
    expect(route).toBe("/edificio-libertad/conserjeria");
  });

  it("resident con tenant válido → /sin-edificio (la web es solo staff)", async () => {
    headersMock.mockReturnValue(DESKTOP_UA);
    const route = await postLoginRoute({ ...baseSession, role: "resident" });
    expect(route).toBe("/sin-edificio");
    expect(tenantFindUnique).not.toHaveBeenCalled();
  });
});
