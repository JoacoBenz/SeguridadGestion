import { describe, expect, it } from "vitest";
import {
  generatePickupCodeString,
  isValidPickupCode,
  PICKUP_CODE_ALPHABET,
  PICKUP_CODE_LENGTH,
} from "@/lib/codes";

describe("pickup codes", () => {
  it("genera códigos del largo correcto", () => {
    for (let i = 0; i < 100; i++) {
      const code = generatePickupCodeString();
      expect(code).toHaveLength(PICKUP_CODE_LENGTH);
    }
  });

  it("nunca usa caracteres ambiguos (0,1,O,I,L,U)", () => {
    for (const ch of "01OILU") {
      expect(PICKUP_CODE_ALPHABET).not.toContain(ch);
    }
    for (let i = 0; i < 200; i++) {
      const code = generatePickupCodeString();
      for (const ch of code) {
        expect(PICKUP_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("isValidPickupCode rechaza largo y alfabeto inválidos", () => {
    expect(isValidPickupCode("ABC")).toBe(false);
    expect(isValidPickupCode("ABCDE0")).toBe(false); // 0 no permitido
    expect(isValidPickupCode("ABCDEF")).toBe(true);
  });
});
