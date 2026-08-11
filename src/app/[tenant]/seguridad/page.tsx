import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { isValidPickupCode } from "@/lib/codes";
import { subscriptionBlockReason, trialDaysLeft } from "@/lib/subscription";
import { SubscriptionWarningBanner } from "@/components/subscription-banner";
import { PackageCard } from "@/components/seguridad/package-card";
import { LogoutButton } from "@/components/logout-button";

export default async function SeguridadHome({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ codigo?: string; avisados?: string }>;
}) {
  const { tenant: slug } = await params;
  const { codigo, avisados } = await searchParams;
  // Sólo el 0 explícito activa la advertencia: sin el parámetro (links viejos,
  // guardados) se asume el caso normal.
  const nadieAvisado = avisados === "0";
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!tenant) notFound();

  const session = await requireTenantRoleOrRedirect(
    tenant.id,
    ["guard", "admin"],
    `/${slug}/seguridad`,
  );
  // Los guardias (incl. sesiones de dispositivo) no ven accesos al panel.
  const canSeeAdmin = session.role === "admin" || session.role === "superadmin";
  const isSuperadmin = session.role === "superadmin";

  const pendientes = await prisma.package.findMany({
    where: { tenantId: tenant.id, status: "awaiting_pickup" },
    orderBy: { receivedAt: "desc" },
    include: { unit: { select: { label: true } } },
    take: 50,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-28 pt-6">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-sm text-ink-400">{tenant.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Seguridad</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <PendingBadge count={pendientes.length} />
          <div className="flex items-center gap-2">
            {isSuperadmin && (
              <Link
                href="/superadmin"
                className="rounded-xl border border-ink-700 px-3 py-2 text-xs text-ink-400 transition-colors hover:text-ink-100"
              >
                ← Edificios
              </Link>
            )}
            {canSeeAdmin && (
              <Link
                href={`/${slug}/admin`}
                className="rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-xs text-ink-300 transition-colors hover:text-ink-100"
              >
                Panel de admin →
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <SubscriptionWarningBanner
        reason={subscriptionBlockReason(tenant)}
        daysLeft={trialDaysLeft(tenant)}
      />

      {codigo && isValidPickupCode(codigo) && (
        <RegisteredBanner code={codigo} nobodyNotified={nadieAvisado} />
      )}

      <section className="flex-1">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Pendientes de retiro
        </h2>
        {pendientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center">
            <p className="text-ink-300">No hay paquetes esperando.</p>
            <p className="mt-1 text-sm text-ink-500">
              Cuando llegue uno, va a aparecer acá.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendientes.map((p) => (
              <PackageCard
                key={p.id}
                unitLabel={p.unit.label}
                pickupCode={p.pickupCode}
                carrier={p.carrier}
                receivedAt={p.receivedAt}
              />
            ))}
          </ul>
        )}
      </section>

      <FloatingActions slug={slug} />
    </main>
  );
}

function RegisteredBanner({
  code,
  nobodyNotified,
}: {
  code: string;
  nobodyNotified: boolean;
}) {
  // Si ningún WhatsApp salió, el paquete quedó registrado pero NADIE se
  // enteró: el banner tiene que gritarlo, no festejar. Es el único caso en que
  // el guardia puede resolverlo en el momento (avisar él, o revisar el número).
  if (nobodyNotified) {
    return (
      <div
        role="alert"
        className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-warn/50 bg-warn/10 px-5 py-4 animate-slide-in-down"
      >
        <div>
          <p className="font-semibold text-warn">Registrado, pero no se pudo avisar a nadie</p>
          <p className="text-sm text-ink-300">
            Ningún WhatsApp salió. Avisale vos al residente y pasale este código.
          </p>
        </div>
        <code
          className="rounded-lg border border-warn/50 bg-ink-900 px-3 py-2 font-mono text-base font-semibold tracking-widest text-warn"
          aria-label="Código de retiro"
        >
          {code}
        </code>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-positive/40 bg-positive/10 px-5 py-4 animate-slide-in-down"
    >
      <div>
        <p className="font-semibold text-positive">Paquete registrado</p>
        <p className="text-sm text-ink-300">El residente ya recibió el WhatsApp con el QR.</p>
      </div>
      <code
        className="rounded-lg border border-positive/40 bg-ink-900 px-3 py-2 font-mono text-base font-semibold tracking-widest text-positive"
        aria-label="Código de retiro"
      >
        {code}
      </code>
    </div>
  );
}

function PendingBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="flex items-center gap-2 rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-400">
        <span className="h-2 w-2 rounded-full bg-ink-500" />
        sin pendientes
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
      <span className="h-2 w-2 rounded-full bg-accent animate-pulse-once" />
      {count} {count === 1 ? "pendiente" : "pendientes"}
    </span>
  );
}

function FloatingActions({ slug }: { slug: string }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-10 border-t border-ink-800 bg-ink-900/95 backdrop-blur"
      // La barra es `fixed`, así que el padding de safe-area del body no la
      // alcanza: sin esto, en un iPhone con barra de gestos los botones quedan
      // parcialmente debajo de ella.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-3xl gap-3 px-4 py-3">
        <Link
          href={`/${slug}/seguridad/ingreso`}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-700 bg-ink-800 py-4 font-semibold text-ink-100 transition-colors hover:border-ink-500"
        >
          <span className="text-lg" aria-hidden>＋</span>
          Registrar
        </Link>
        <Link
          href={`/${slug}/seguridad/retiro`}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-4 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          <span className="text-lg" aria-hidden>✓</span>
          Retirar
        </Link>
      </div>
    </div>
  );
}
