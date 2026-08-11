import { NextResponse, type NextRequest } from "next/server";

// Chequeo OPTIMISTA: solo mira si existe la cookie de sesión de Auth.js para
// redirigir temprano a /login. No valida la sesión (eso requiere DB y acá es
// edge) — la autorización real sigue viviendo en cada page y server action
// (requireTenantRoleOrRedirect / requireTenantRole). Esto ahorra un render +
// query por hit anónimo y mejora el redirect, nada más.

// Auth.js session, o la cookie de dispositivo de seguridad (PIN). Cualquiera
// de las dos alcanza para dejar pasar acá; la autorización real la hace la page.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "pok_device",
];

export function middleware(req: NextRequest) {
  // La página de desbloqueo por PIN tiene que ser accesible SIN sesión — es donde
  // el dispositivo obtiene la cookie. No la redirijas al login.
  if (req.nextUrl.pathname.endsWith("/seguridad/desbloquear")) {
    return NextResponse.next();
  }

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
    "/:tenant/seguridad/:path*",
    "/:tenant/admin",
    "/:tenant/seguridad",
  ],
};
