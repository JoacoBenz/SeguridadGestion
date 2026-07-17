import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  const tenant = session?.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.tenantId },
        select: { slug: true },
      })
    : null;

  // Destino según rol: guardia/admin a la conserjería, residente a sus paquetes.
  const primaryLink = tenant
    ? session!.role === "resident"
      ? { href: `/${tenant.slug}/residente/mis-paquetes`, label: "Ver mis paquetes" }
      : { href: `/${tenant.slug}/conserjeria`, label: "Entrar a la conserjería" }
    : session?.role === "superadmin"
      ? { href: "/superadmin", label: "Panel superadmin" }
      : null;

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
        {primaryLink ? (
          <Link
            href={primaryLink.href}
            className="rounded-2xl bg-accent px-6 py-4 text-center font-semibold text-accent-fg transition-transform active:scale-[0.98]"
          >
            {primaryLink.label}
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-2xl bg-accent px-6 py-4 text-center font-semibold text-accent-fg transition-transform active:scale-[0.98]"
          >
            Iniciar sesión
          </Link>
        )}
        {session?.role === "admin" && tenant && (
          <Link
            href={`/${tenant.slug}/admin`}
            className="rounded-2xl border border-ink-700 bg-ink-850 px-6 py-4 text-center font-medium text-ink-100 transition-colors hover:border-ink-500"
          >
            Administración
          </Link>
        )}
      </div>
    </main>
  );
}
