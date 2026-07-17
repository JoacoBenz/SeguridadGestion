import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

// Minimal session shape used across server actions and pages. Resolved via
// Auth.js by default; tests can override with setSessionResolver().
export interface Session {
  userId: string;
  tenantId: string | null;
  role: Role;
  name: string;
}

// Lazy-imported so unit tests that stub the resolver never load Auth.js.
const defaultResolver = async (): Promise<Session | null> => {
  const { auth: nextAuth } = await import("@/lib/auth/config");
  const nextSession = await nextAuth();
  if (nextSession?.user?.id) {
    return {
      userId: nextSession.user.id,
      tenantId: nextSession.user.tenantId,
      role: nextSession.user.role,
      name: nextSession.user.name,
    };
  }
  // Fallback: sesión de dispositivo (PIN de conserjería). Cookie firmada -> guard.
  return resolveDeviceSession();
};

async function resolveDeviceSession(): Promise<Session | null> {
  const { cookies } = await import("next/headers");
  const { DEVICE_COOKIE, decodeDeviceCookie } = await import("@/lib/auth/device");
  const cookieStore = await cookies();
  const payload = decodeDeviceCookie(cookieStore.get(DEVICE_COOKIE)?.value);
  if (!payload) return null;
  return {
    userId: payload.userId,
    tenantId: payload.tenantId,
    role: "guard",
    name: "Conserjería (dispositivo)",
  };
}

let sessionResolver: () => Promise<Session | null> = defaultResolver;

export function setSessionResolver(resolver: () => Promise<Session | null>): void {
  sessionResolver = resolver;
}

export function resetSessionResolver(): void {
  sessionResolver = defaultResolver;
}

export async function getSession(): Promise<Session | null> {
  return sessionResolver();
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

// For use in Server Components / pages. Redirects to /login if no session.
export async function requireSessionOrRedirect(callbackPath?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const cb = callbackPath ? `?callbackUrl=${encodeURIComponent(callbackPath)}` : "";
    redirect(`/login${cb}`);
  }
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

// Page-level guard for /superadmin/... routes. Cross-tenant, so no tenantId.
export async function requireSuperadminOrRedirect(callbackPath?: string): Promise<Session> {
  const session = await requireSessionOrRedirect(callbackPath);
  if (session.role !== "superadmin") redirect("/403");
  return session;
}

// Page-level guard: redirects to /login if no session, /403 if wrong tenant/role.
export async function requireTenantRoleOrRedirect(
  tenantId: string,
  allowed: Role[],
  callbackPath?: string,
): Promise<Session> {
  const session = await requireSessionOrRedirect(callbackPath);
  if (session.role === "superadmin") return session;
  if (session.tenantId !== tenantId) redirect("/403");
  if (!allowed.includes(session.role)) redirect("/403");
  return session;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
