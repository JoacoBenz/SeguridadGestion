import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { isPhoneUserAgent } from "@/lib/device";
import type { Session } from "@/lib/auth";

// Decide where to send a user right after they authenticate.
// The web is for staff only — residents are pointed to /sin-edificio with a
// "use WhatsApp" message regardless of tenant binding.
// Admins on phones → conserjería (operative view); on desktop → /admin (dashboard).
// Guards → conserjería. Superadmin → /superadmin.
export async function postLoginRoute(session: Session): Promise<string> {
  if (session.role === "superadmin") return "/superadmin";
  if (session.role === "resident") return "/sin-edificio";
  if (!session.tenantId) return "/sin-edificio";

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { slug: true },
  });
  if (!tenant) return "/sin-edificio";

  if (session.role === "admin") {
    const ua = (await headers()).get("user-agent");
    return isPhoneUserAgent(ua)
      ? `/${tenant.slug}/conserjeria`
      : `/${tenant.slug}/admin`;
  }

  return `/${tenant.slug}/conserjeria`;
}
