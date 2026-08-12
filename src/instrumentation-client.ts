import * as Sentry from "@sentry/nextjs";

// Errores del browser (la tablet del puesto, el celular del admin). El DSN
// viaja al bundle en build, por eso la env necesita el prefijo NEXT_PUBLIC.
// Los eventos salen por el tunnel /monitoring del propio dominio — el CSP
// tiene connect-src 'self' y no hace falta abrirlo para el host de Sentry.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sólo errores; sin replay ni tracing (cuota y bundle).
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
