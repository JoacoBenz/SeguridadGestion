import { NextResponse, type NextRequest } from "next/server";

// Chequeo OPTIMISTA: solo mira si existe la cookie de sesión de Auth.js para
// redirigir temprano a /login. No valida la sesión (eso requiere DB y acá es
// edge) — la autorización real sigue viviendo en cada page y server action
// (requireTenantRoleOrRedirect / requireTenantRole). Esto ahorra un render +
// query por hit anónimo y mejora el redirect, nada más.

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(req: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/superadmin/:path*",
    "/:tenant/admin/:path*",
    "/:tenant/conserjeria/:path*",
    "/:tenant/admin",
    "/:tenant/conserjeria",
  ],
};
