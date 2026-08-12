import * as Sentry from "@sentry/nextjs";

// Punto de entrada de instrumentación de Next: carga la config de Sentry del
// runtime que corresponda y captura los errores de server (RSC, server
// actions, route handlers) vía onRequestError.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
