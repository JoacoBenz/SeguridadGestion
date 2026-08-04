import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { unlockDeviceAction } from "@/server/conserjeria/device";

// Página pública: el PIN ES la credencial. Deja la cookie de dispositivo y manda
// a la conserjería. Si el edificio no tiene PIN configurado, lo dice.
export default async function DesbloquearPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error } = await searchParams;
  // Página PÚBLICA (es donde la tablet consigue la cookie): el ?error= lo
  // arma quien manda el link, y un cartel oficial con texto ajeno es phishing.
  // Sólo se muestran los mensajes que unlockDeviceAction realmente emite.
  const UNLOCK_ERRORS = new Set([
    "Demasiados intentos. Esperá un minuto.",
    "Edificio no encontrado",
    "PIN incorrecto",
  ]);
  const shownError = error && UNLOCK_ERRORS.has(error) ? error : error ? "No se pudo desbloquear. Probá de nuevo." : null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, settings: true },
  });
  if (!tenant) notFound();

  const hasPin = Boolean((tenant.settings as Record<string, unknown>)?.guardPinHash);
  const unlock = unlockDeviceAction.bind(null, slug);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6">
      <header className="text-center">
        <p className="text-sm text-ink-400">{tenant.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Conserjería</h1>
        <p className="mt-2 text-sm text-ink-400">
          Ingresá el PIN del edificio para desbloquear este dispositivo.
        </p>
      </header>

      {shownError && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-center text-sm text-critical">
          {shownError}
        </div>
      )}

      {!hasPin ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-8 text-center text-sm text-ink-400">
          Este edificio todavía no tiene un PIN de conserjería. Pedile al administrador que lo
          configure desde el panel, o iniciá sesión con tu email.
        </div>
      ) : (
        <form action={unlock} className="flex flex-col gap-4">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            required
            placeholder="••••"
            className="w-full rounded-2xl border-2 border-ink-700 bg-ink-850 px-4 py-4 text-center font-mono text-3xl tracking-[0.5em] text-ink-100 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
          >
            Desbloquear
          </button>
        </form>
      )}

      <a href="/login" className="text-center text-sm text-ink-500 hover:text-ink-300">
        Entrar con email en su lugar
      </a>
    </main>
  );
}
