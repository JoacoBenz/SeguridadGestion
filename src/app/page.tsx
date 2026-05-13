import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold">PaqueteOK</h1>
      <p className="text-slate-600">
        Gestión digital de paquetes para edificios. Reemplazá el cuaderno de la conserjería por
        notificaciones automáticas y retiros con código + QR.
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/edificio-libertad/conserjeria"
          className="rounded-lg bg-brand px-4 py-2 text-center text-brand-fg"
        >
          Ir a la conserjería del edificio piloto
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-4 py-2 text-center"
        >
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
