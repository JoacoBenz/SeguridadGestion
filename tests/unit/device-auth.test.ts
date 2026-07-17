import { describe, it, expect, beforeAll } from "vitest";
import {
  hashPin,
  verifyPin,
  encodeDeviceCookie,
  decodeDeviceCookie,
} from "@/lib/auth/device";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-device-cookies";
});

describe("device PIN hashing", () => {
  it("verifies the correct PIN and rejects wrong ones", () => {
    const stored = hashPin("1234");
    expect(verifyPin("1234", stored)).toBe(true);
    expect(verifyPin("1235", stored)).toBe(false);
    expect(verifyPin("", stored)).toBe(false);
  });

  it("uses a random salt (two hashes of same PIN differ)", () => {
    expect(hashPin("1234")).not.toBe(hashPin("1234"));
  });

  it("rejects malformed stored values", () => {
    expect(verifyPin("1234", "garbage")).toBe(false);
    expect(verifyPin("1234", "bcrypt$aa$bb")).toBe(false);
  });
});

describe("device cookie signing", () => {
  const payload = { tenantId: "t1", userId: "u1", role: "guard" as const };

  it("round-trips a valid signed cookie", () => {
    const cookie = encodeDeviceCookie(payload);
    expect(decodeDeviceCookie(cookie)).toEqual(payload);
  });

  it("rejects a tampered body", () => {
    const cookie = encodeDeviceCookie(payload);
    const [, sig] = cookie.split(".");
    const forged = `${Buffer.from(JSON.stringify({ ...payload, tenantId: "evil" })).toString("base64url")}.${sig}`;
    expect(decodeDeviceCookie(forged)).toBeNull();
  });

  it("rejects a bad signature and junk", () => {
    const cookie = encodeDeviceCookie(payload);
    const body = cookie.split(".")[0];
    expect(decodeDeviceCookie(`${body}.deadbeef`)).toBeNull();
    expect(decodeDeviceCookie("nodot")).toBeNull();
    expect(decodeDeviceCookie(undefined)).toBeNull();
  });
});
