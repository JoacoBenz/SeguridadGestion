import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { PackageCard } from "@/components/conserjeria/package-card";
import { AuthorizationCard } from "@/components/conserjeria/authorization-card";
import { AutoRefresh } from "@/components/conserjeria/auto-refresh";
import { IncidentQuickForm } from "@/components/conserjeria/incident-quick-form";
import { guardReportIssueAction } from "@/server/admin/issues";
import { clearExpiredVacationsForTenant } from "@/server/access/clear-expired-vacations";

export default async function ConserjeriaHome({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { tenant: slug } = await params;
  const { ok, error } = await searchParams;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  const session = await requireTenantRoleOrRedirect(
    tenant.id,
    ["guard", "admin"],
    `/${slug}/conserjeria`,
  );
  // Guards now have access to a subset of admin tabs (paquetes, autorizaciones,
  // incidentes, reportes, objetos), so the link is visible to them too.
  const canSeeAdmin =
    session.role === "admin" || session.role === "superadmin" || session.role === "guard";
  const adminLinkLabel = session.role === "guard" ? "Panel →" : "Administración →";

  await clearExpiredVacationsForTenant(tenant.id);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const todayDow = now.getDay();

  const [pendientes, visitors, recurringToday, residentsOnVacation, openIssues] =
    await Promise.all([
      prisma.package.findMany({
        where: { tenantId: tenant.id, status: "awaiting_pickup" },
        orderBy: { receivedAt: "desc" },
        include: { unit: { select: { label: true } } },
        take: 50,
      }),
      prisma.visitorEvent.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ["pending", "confirmed"] },
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        include: { unit: { select: { label: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.recurringAuthorization.findMany({
        where: {
          tenantId: tenant.id,
          status: "active",
          daysOfWeek: { has: todayDow },
          OR: [{ validUntil: null }, { validUntil: { gte: startOfDay } }],
        },
        include: { unit: { select: { label: true } } },
        orderBy: { startTime: "asc" },
      }),
      prisma.user.findMany({
        where: {
          tenantId: tenant.id,
          role: "resident",
          vacationStart: { lte: endOfDay },
          vacationEnd: { gte: startOfDay },
        },
        include: { unitMemberships: { select: { unitId: true } } },
      }),
      prisma.issue.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ["open", "acknowledged"] },
          kind: { in: ["panic", "suspicious"] },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        include: { unit: { select: { label: true } } },
        take: 10,
      }),
    ]);

  const vacationUnitIds = new Set(
    residentsOnVacation.flatMap((u) => u.unitMemberships.map((m) => m.unitId)),
  );

  const reportIncident = guardReportIssueAction.bind(null, slug);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-28 pt-6">
      <AutoRefresh />

      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-sm text-ink-400">{tenant.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Conserjería</h1>
        </div>
        <div className="flex items-center gap-2">
          <PendingBadge count={pendientes.length} />
          <Link
            href={`/${slug}/conserjeria/actividad`}
            className="rounded-xl border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:text-ink-100"
          >
            Actividad →
          </Link>
          {canSeeAdmin && (
            <Link
              href={`/${slug}/admin`}
              className="rounded-xl border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:text-ink-100"
            >
              {adminLinkLabel}
            </Link>
          )}
        </div>
      </header>

      {ok && (
        <div className="mb-4 rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          {ok === "incidente-registrado" ? "Incidente registrado" : "Listo"}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      {openIssues.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-warn">
            Atención
          </h2>
          <ul className="flex flex-col gap-2">
            {openIssues.map((it) => (
              <li
                key={it.id}
                className={`rounded-2xl border bg-ink-800 px-5 py-3 ${
                  it.severity === "critical" ? "border-critical/60" : "border-warn/40"
                }`}
              >
                <p className="flex items-center gap-2 text-xs text-ink-400">
                  <span className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-warn">
                    {it.kind === "panic" ? "🚨 Pánico" : "Sospechoso"}
                  </span>
                  {it.unit && (
                    <span className="rounded-full border border-ink-700 px-2 py-0.5">
                      unidad {it.unit.label}
                    </span>
                  )}
                  <span>{it.createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </p>
                <p className="mt-1 text-sm text-ink-100">{it.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Autorizaciones de hoy
        </h2>
        {visitors.length === 0 && recurringToday.length === 0 ? (
          <p className="text-sm text-ink-500">Sin autorizaciones para hoy.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visitors.map((v) => (
              <AuthorizationCard
                key={`v-${v.id}`}
                unitLabel={v.unit.label}
                who={v.visitorName}
                kind="visitor"
                detail={
                  v.expectedTime
                    ? `Llegada ${v.expectedTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Sin hora específica"
                }
                vehiclePlate={v.vehiclePlate}
                onVacation={vacationUnitIds.has(v.unitId)}
              />
            ))}
            {recurringToday.map((r) => (
              <AuthorizationCard
                key={`r-${r.id}`}
                unitLabel={r.unit.label}
                who={r.name}
                kind="recurring"
                detail={`${r.startTime}–${r.endTime}`}
                onVacation={vacationUnitIds.has(r.unitId)}
              />
            ))}
          </ul>
        )}
      </section>

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

      <FloatingActions slug={slug} action={reportIncident} />
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

function FloatingActions({
  slug,
  action,
}: {
  slug: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink-800 bg-ink-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3">
        <Link
          href={`/${slug}/conserjeria/ingreso`}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-700 bg-ink-800 py-4 font-semibold text-ink-100 transition-colors hover:border-ink-500"
        >
          <span className="text-lg" aria-hidden>＋</span>
          Registrar
        </Link>
        <IncidentQuickForm slug={slug} action={action} />
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
