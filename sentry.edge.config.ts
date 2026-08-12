import * as Sentry from "@sentry/nextjs";

// Runtime edge (middleware). Mismo criterio que el server: sólo errores.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({ dsn, sendDefaultPii: false });
}
