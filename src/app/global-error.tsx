"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Último recurso: si el que falla es el root layout, `error.tsx` no llega a
// montarse porque vive adentro. Este reemplaza el documento entero, así que
// tiene que traer sus propios <html> y <body> — y no puede usar las clases de
// Tailwind del layout, que es justamente lo que no cargó.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error.message);
    // Los error boundaries se tragan la excepción: sin esto, Sentry nunca la ve.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es-AR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0B",
          color: "#F4F4F5",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Algo salió mal</h1>
          <p style={{ color: "#A1A1AA", margin: "0 0 24px", fontSize: 14 }}>
            No pudimos cargar PackItO. Probá de nuevo en unos segundos.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#FBBF24",
              color: "#0A0A0B",
              border: 0,
              borderRadius: 16,
              padding: "16px 32px",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Reintentar
          </button>
          {error.digest && (
            <p style={{ color: "#71717A", fontSize: 12, marginTop: 24 }}>
              Código de error: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
