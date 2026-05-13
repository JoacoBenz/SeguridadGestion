import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <p className="font-mono text-7xl font-bold tracking-tighter text-ink-700">403</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Acceso denegado</h1>
      <p className="mt-3 text-ink-400">No tenés permiso para ver esta sección.</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-xl border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-ink-300 transition-colors hover:text-ink-100"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
