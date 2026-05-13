import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

// Minimal session shape used across server actions and pages. The full Auth.js
// integration lives behind this function so that tests can stub it.
export interface Session {
  userId: string;
  tenantId: string | null;
  role: Role;
  name: string;
}

let sessionResolver: () => Promise<Session | null> = async () => null;

export function setSessionResolver(resolver: () => Promise<Session | null>): void {
  sessionResolver = resolver;
}

export async function getSession(): Promise<Session | null> {
  return sessionResolver();
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireTenantRole(
  tenantId: string,
  allowed: Role[],
): Promise<Session> {
  const session = await requireSession();
  if (session.role === "superadmin") return session;
  if (session.tenantId !== tenantId) throw new Error("FORBIDDEN_TENANT");
  if (!allowed.includes(session.role)) throw new Error("FORBIDDEN_ROLE");
  return session;
}

// Helper used by the seed and admin bootstrap to look up the current user
// without a request context (e.g., from CLI scripts).
export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
