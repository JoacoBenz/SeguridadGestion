import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { postLoginRoute } from "@/lib/post-login-route";

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect(await postLoginRoute(session));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-12">
      <div>
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          PaqueteOK
        </span>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          El cuaderno de la conserjería,
          <br />
          <span className="text-ink-400">en serio digitalizado.</span>
        </h1>
      </div>
      <p className="max-w-prose text-lg text-ink-300">
        Notificaciones automáticas por WhatsApp, retiros con código + QR, trazabilidad de cada
        paquete. Pensado para que el guardia haga menos clicks que con un cuaderno.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/edificio-libertad/conserjeria"
          className="rounded-2xl bg-accent px-6 py-4 text-center font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Entrar a la conserjería del piloto
        </Link>
        <Link
          href="/login"
          className="rounded-2xl border border-ink-700 bg-ink-850 px-6 py-4 text-center font-medium text-ink-100 transition-colors hover:border-ink-500"
        >
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
