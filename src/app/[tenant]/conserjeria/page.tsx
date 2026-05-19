import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { PackageCard } from "@/components/conserjeria/package-card";
import {
  listAuthorizationsForToday,
  listResidentsOnVacation,
} from "@/server/access/today";

export default async function ConserjeriaHome({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  await requireTenantRoleOrRedirect(tenant.id, ["guard", "admin"], `/${slug}/conserjeria`);

  const now = new Date();
  const [pendientes, authsToday, residentsOnVacation] = await Promise.all([
    prisma.package.findMany({
      where: { tenantId: tenant.id, status: "awaiting_pickup" },
      orderBy: { receivedAt: "desc" },
      include: { unit: { select: { label: true } } },
      take: 50,
    }),
    listAuthorizationsForToday(tenant.id, now),
    listResidentsOnVacation(tenant.id, now),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-28 pt-6">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-sm text-ink-400">{tenant.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Conserjería</h1>
        </div>
        <PendingBadge count={pendientes.length} />
      </header>

      {authsToday.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
            Autorizaciones de hoy
          </h2>
          <ul className="flex flex-col gap-2">
            {authsToday.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink-100">{a.name}</p>
                  <p className="text-xs text-ink-400">
                    <span className="font-mono">{a.unitLabel}</span> ·{" "}
                    <span className="font-mono">
                      {a.startTime}–{a.endTime}
                    </span>
                  </p>
                </div>
                <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  fija
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {residentsOnVacation.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
            En vacaciones
          </h2>
          <div className="flex flex-wrap gap-2">
            {residentsOnVacation.map((r) => (
              <span
                key={r.userId}
                className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-xs text-warn"
              >
                <span aria-hidden>✈</span>
                {r.name}
                {r.unitLabel && (
                  <span className="font-mono text-warn/70">· {r.unitLabel}</span>
                )}
              </span>
            ))}
          </div>
        </section>
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
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink-800 bg-ink-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl gap-3 px-4 py-3">
        <Link
          href={`/${slug}/conserjeria/ingreso`}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-700 bg-ink-800 py-4 font-semibold text-ink-100 transition-colors hover:border-ink-500"
        >
          <span className="text-lg" aria-hidden>＋</span>
          Registrar
        </Link>
        <Link
          href={`/${slug}/conserjeria/retiro`}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-4 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          <span className="text-lg" aria-hidden>✓</span>
          Retirar
        </Link>
      </div>
    </div>
  );
}
