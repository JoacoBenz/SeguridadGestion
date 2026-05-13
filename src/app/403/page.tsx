import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-bold">Acceso denegado</h1>
      <p className="mt-3 text-slate-600">No tenés permiso para ver esta sección.</p>
      <Link href="/" className="mt-6 underline">
        Volver al inicio
      </Link>
    </main>
  );
}
