import * as Sentry from "@sentry/nextjs";

// Sin DSN (dev local) no se inicializa: los errores siguen yendo a stdout como
// siempre y no hay warnings de Sentry ensuciando la consola.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sólo errores. Tracing/replay quedan apagados a propósito: comen cuota y
    // lo que necesitamos saber es "algo se rompió y dónde".
    sendDefaultPii: false,
  });
}
