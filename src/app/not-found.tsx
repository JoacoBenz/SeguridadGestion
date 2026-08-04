import Link from "next/link";

// 404 de la app. Lo alcanza cualquier `notFound()` — típicamente un slug de
// edificio que no existe o quedó mal tipeado en la URL.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12 text-center">
      <div>
        <p className="font-mono text-5xl font-bold text-ink-600">404</p>
        <h1 className="mt-4 text-2xl font-bold text-ink-100">No encontramos esta página</h1>
        <p className="mt-2 text-sm text-ink-400">
          Puede que el link esté mal escrito, o que el edificio ya no exista.
        </p>
      </div>
      <Link
        href="/login"
        className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
      >
        Ir a iniciar sesión
      </Link>
    </main>
  );
}
