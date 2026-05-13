import { afterEach, describe, expect, it } from "vitest";
import {
  getSession,
  requireSession,
  requireTenantRole,
  setSessionResolver,
  resetSessionResolver,
  type Session,
} from "@/lib/auth";

const adminLibertad: Session = {
  userId: "u_admin",
  tenantId: "t_libertad",
  role: "admin",
  name: "Admin",
};
const guardLibertad: Session = {
  userId: "u_guard",
  tenantId: "t_libertad",
  role: "guard",
  name: "Guard",
};
const residentLibertad: Session = {
  userId: "u_res",
  tenantId: "t_libertad",
  role: "resident",
  name: "Resi",
};
const superadmin: Session = {
  userId: "u_super",
  tenantId: null,
  role: "superadmin",
  name: "Super",
};

afterEach(() => {
  resetSessionResolver();
});

describe("getSession / requireSession", () => {
  it("getSession devuelve null por default cuando no hay sesión", async () => {
    setSessionResolver(async () => null);
    expect(await getSession()).toBeNull();
  });

  it("requireSession tira UNAUTHENTICATED sin sesión", async () => {
    setSessionResolver(async () => null);
    await expect(requireSession()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("requireSession devuelve la sesión cuando existe", async () => {
    setSessionResolver(async () => adminLibertad);
    await expect(requireSession()).resolves.toEqual(adminLibertad);
  });
});

describe("requireTenantRole", () => {
  it("acepta cuando tenant y rol coinciden", async () => {
    setSessionResolver(async () => guardLibertad);
    await expect(
      requireTenantRole("t_libertad", ["guard", "admin"]),
    ).resolves.toEqual(guardLibertad);
  });

  it("rechaza con FORBIDDEN_TENANT si la sesión es de otro tenant", async () => {
    setSessionResolver(async () => ({ ...guardLibertad, tenantId: "t_otro" }));
    await expect(
      requireTenantRole("t_libertad", ["guard", "admin"]),
    ).rejects.toThrow("FORBIDDEN_TENANT");
  });

  it("rechaza con FORBIDDEN_ROLE si el rol no está permitido", async () => {
    setSessionResolver(async () => residentLibertad);
    await expect(
      requireTenantRole("t_libertad", ["guard", "admin"]),
    ).rejects.toThrow("FORBIDDEN_ROLE");
  });

  it("superadmin pasa por encima del tenant", async () => {
    setSessionResolver(async () => superadmin);
    await expect(
      requireTenantRole("t_cualquiera", ["guard"]),
    ).resolves.toEqual(superadmin);
  });

  it("propaga UNAUTHENTICATED si no hay sesión", async () => {
    setSessionResolver(async () => null);
    await expect(
      requireTenantRole("t_libertad", ["admin"]),
    ).rejects.toThrow("UNAUTHENTICATED");
  });
});
