"use client";

import Link from "next/link";
import { useEffect } from "react";

// Error boundary de la app. Sin esto, cualquier excepción en una page le
// muestra al guardia la pantalla gris de Next en inglés y sin forma de volver.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El digest es lo único que permite cruzar lo que vio el usuario con la
    // línea del log del server: el mensaje real nunca llega al cliente en prod.
    console.error("[error-boundary]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12 text-center">
      <div>
        <p className="text-5xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="mt-4 text-2xl font-bold text-ink-100">Algo salió mal</h1>
        <p className="mt-2 text-sm text-ink-400">
          No pudimos cargar esta pantalla. El paquete que estabas registrando no se guardó:
          probá de nuevo.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3 font-medium text-ink-200 transition-colors hover:border-ink-500"
        >
          Volver al inicio
        </Link>
      </div>

      {error.digest && (
        <p className="font-mono text-xs text-ink-600">
          Código de error: {error.digest}
        </p>
      )}
    </main>
  );
}
