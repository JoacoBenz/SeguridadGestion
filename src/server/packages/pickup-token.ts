// Pure helper: takes whatever the QR scanner returned (or whatever a guard
// pasted) and reduces it to the pickup token, or null if it doesn't look
// like one. Lives in its own module so it can be unit-tested without the
// "use server" boundary in pickup-actions.ts.

const MIN_TOKEN_LEN = 8;
const MAX_TOKEN_LEN = 64;
const TOKEN_CHARS = /^[A-Za-z0-9_-]+$/;

export function extractPickupToken(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let pathOrToken = trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      pathOrToken = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }

  // Strip query and fragment.
  const cleaned = pathOrToken.split("?")[0]!.split("#")[0]!;

  let token = cleaned;
  if (cleaned.includes("/")) {
    const parts = cleaned.split("/").filter(Boolean);
    token = parts.at(-1) ?? "";
  }

  if (!token) return null;
  if (token.length < MIN_TOKEN_LEN || token.length > MAX_TOKEN_LEN) return null;
  if (!TOKEN_CHARS.test(token)) return null;

  return token;
}
