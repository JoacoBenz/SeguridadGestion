import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";

// Crockford-ish alphabet: no 0/O/1/I/L/U to avoid pickup-desk misreads.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 6;

export function generatePickupCodeString(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

// Reserves a code that is not currently in use by another active package
// in the same tenant. Retries on collision; throws after a hard cap.
export async function generateUniquePickupCode(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generatePickupCodeString();
    const collision = await prisma.package.findFirst({
      where: {
        tenantId,
        pickupCode: candidate,
        status: "awaiting_pickup",
      },
      select: { id: true },
    });
    if (!collision) return candidate;
  }
  throw new Error("No se pudo generar un código de retiro único");
}

export function isValidPickupCode(input: string): boolean {
  if (input.length !== CODE_LENGTH) return false;
  for (const ch of input) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

export const PICKUP_CODE_ALPHABET = ALPHABET;
export const PICKUP_CODE_LENGTH = CODE_LENGTH;
