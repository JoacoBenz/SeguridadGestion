import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { KpiCard } from "@/components/admin/kpi-card";

export default async function ReportesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    received,
    pickedUp,
    cancelled,
    topCarriers,
    topUnits,
    pickupSamples,
    visitorsMonth,
    visitorsConfirmed,
    activeRecurring,
    pausedRecurring,
    residentsOnVacation,
    issuesByStatus,
    issuesByKind,
    criticalIssues,
    avgIssueResolution,
    broadcastsMonth,
    lastBroadcast,
    faqCount,
    lostFoundByStatus,
  ] = await Promise.all([
    prisma.package.count({
      where: { tenantId: tenant.id, receivedAt: { gte: startOfMonth } },
    }),
    prisma.package.count({
      where: {
        tenantId: tenant.id,
        status: "picked_up",
        pickedUpAt: { gte: startOfMonth },
      },
    }),
    prisma.package.count({
      where: {
        tenantId: tenant.id,
        status: "cancelled",
        cancelledAt: { gte: startOfMonth },
      },
    }),
    prisma.package.groupBy({
      by: ["carrier"],
      where: { tenantId: tenant.id, receivedAt: { gte: startOfMonth } },
      _count: { _all: true },
      orderBy: { _count: { carrier: "desc" } },
      take: 5,
    }),
    prisma.package.groupBy({
      by: ["unitId"],
      where: { tenantId: tenant.id, receivedAt: { gte: startOfMonth } },
      _count: { _all: true },
      orderBy: { _count: { unitId: "desc" } },
      take: 5,
    }),
    prisma.package.findMany({
      where: {
        tenantId: tenant.id,
        status: "picked_up",
        pickedUpAt: { gte: last30, not: null },
      },
      select: { receivedAt: true, pickedUpAt: true },
      take: 200,
    }),
    // Visitors
    prisma.visitorEvent.count({
      where: { tenantId: tenant.id, createdAt: { gte: startOfMonth } },
    }),
    prisma.visitorEvent.count({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: startOfMonth },
        status: "confirmed",
      },
    }),
    // Recurring auths
    prisma.recurringAuthorization.count({
      where: { tenantId: tenant.id, status: "active" },
    }),
    prisma.recurringAuthorization.count({
      where: { tenantId: tenant.id, status: "paused" },
    }),
    prisma.user.count({
      where: {
        tenantId: tenant.id,
        role: "resident",
        vacationStart: { not: null },
      },
    }),
    // Issues
    prisma.issue.groupBy({
      by: ["status"],
      where: { tenantId: tenant.id, createdAt: { gte: startOfMonth } },
      _count: { _all: true },
    }),
    prisma.issue.groupBy({
      by: ["kind"],
      where: { tenantId: tenant.id, createdAt: { gte: startOfMonth } },
      _count: { _all: true },
      orderBy: { _count: { kind: "desc" } },
    }),
    prisma.issue.count({
      where: {
        tenantId: tenant.id,
        severity: "critical",
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.issue.findMany({
      where: {
        tenantId: tenant.id,
        status: "resolved",
        resolvedAt: { gte: last30, not: null },
      },
      select: { createdAt: true, resolvedAt: true },
      take: 200,
    }),
    // Broadcasts
    prisma.broadcast.count({
      where: { tenantId: tenant.id, sentAt: { gte: startOfMonth } },
    }),
    prisma.broadcast.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true, recipientCount: true, subject: true },
    }),
    // FAQ + lost & found
    prisma.faqEntry.count({ where: { tenantId: tenant.id } }),
    prisma.lostFoundItem.groupBy({
      by: ["status"],
      where: { tenantId: tenant.id },
      _count: { _all: true },
    }),
  ]);

  const avgHoursToPickup =
    pickupSamples.length === 0
      ? null
      : Math.round(
          pickupSamples.reduce((acc, p) => {
            return acc + (p.pickedUpAt!.getTime() - p.receivedAt.getTime());
          }, 0) /
            pickupSamples.length /
            (60 * 60 * 1000),
        );

  const pickupRate =
    received === 0 ? null : Math.round((pickedUp / received) * 100);

  // Resolver labels de unidades para top
  const topUnitIds = topUnits.map((u) => u.unitId);
  const unitLabels = topUnitIds.length
    ? await prisma.unit.findMany({
        where: { id: { in: topUnitIds } },
        select: { id: true, label: true },
      })
    : [];
  const labelById = new Map(unitLabels.map((u) => [u.id, u.label]));

  const issuesOpenCount =
    (issuesByStatus.find((s) => s.status === "open")?._count._all ?? 0) +
    (issuesByStatus.find((s) => s.status === "acknowledged")?._count._all ?? 0);
  const issuesResolvedCount =
    issuesByStatus.find((s) => s.status === "resolved")?._count._all ?? 0;
  const issuesTotal = issuesByStatus.reduce((acc, s) => acc + s._count._all, 0);

  const avgIssueHours =
    avgIssueResolution.length === 0
      ? null
      : Math.round(
          avgIssueResolution.reduce(
            (acc, i) => acc + (i.resolvedAt!.getTime() - i.createdAt.getTime()),
            0,
          ) /
            avgIssueResolution.length /
            (60 * 60 * 1000),
        );

  const lostByStatus = (status: "lost" | "claimed" | "disposed") =>
    lostFoundByStatus.find((l) => l.status === status)?._count._all ?? 0;

  const ISSUE_KIND_LABEL: Record<string, string> = {
    maintenance: "Mantenimiento",
    noise: "Ruido",
    suspicious: "Sospechoso",
    panic: "Pánico",
    incident: "Incidente",
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-xl font-bold">Reportes</h2>
        <p className="text-xs text-ink-400">
          Datos desde {startOfMonth.toLocaleDateString("es-AR")}
        </p>
      </header>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Mes en curso
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Recibidos" value={received} href={`/${slug}/admin/paquetes`} />
          <KpiCard
            label="Retirados"
            value={pickedUp}
            tone="positive"
            href={`/${slug}/admin/paquetes`}
          />
          <KpiCard
            label="Cancelados"
            value={cancelled}
            tone="neutral"
            href={`/${slug}/admin/paquetes`}
          />
          <KpiCard
            label="% retirados"
            value={pickupRate !== null ? `${pickupRate}%` : "—"}
            hint="del total recibido"
            tone={pickupRate !== null && pickupRate >= 80 ? "positive" : "neutral"}
            href={`/${slug}/admin/paquetes`}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Velocidad
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiCard
            label="Promedio a retiro"
            value={avgHoursToPickup !== null ? `${formatHours(avgHoursToPickup)}` : "—"}
            hint="últimos 30 días (hasta 200 muestras)"
            href={`/${slug}/admin/paquetes`}
          />
          <KpiCard
            label="Muestras"
            value={pickupSamples.length}
            hint="retiros con timestamp"
            href={`/${slug}/admin/paquetes`}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankingCard
          title="Top transportistas"
          rows={topCarriers.map((c) => ({
            label: c.carrier ?? "Sin transportista",
            count: c._count._all,
          }))}
          totalForBars={topCarriers[0]?._count._all ?? 1}
        />
        <RankingCard
          title="Deptos con más actividad"
          rows={topUnits.map((u) => ({
            label: labelById.get(u.unitId) ?? "?",
            count: u._count._all,
          }))}
          totalForBars={topUnits[0]?._count._all ?? 1}
        />
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Visitas y autorizaciones
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Visitas / mes"
            value={visitorsMonth}
            href={`/${slug}/conserjeria`}
          />
          <KpiCard
            label="Confirmadas"
            value={visitorsConfirmed}
            hint="del mes"
            tone="positive"
            href={`/${slug}/conserjeria`}
          />
          <KpiCard
            label="Autorizaciones fijas"
            value={activeRecurring}
            hint={pausedRecurring ? `${pausedRecurring} en pausa` : "activas"}
            href={`/${slug}/admin/autorizaciones`}
          />
          <KpiCard
            label="En vacaciones"
            value={residentsOnVacation}
            tone={residentsOnVacation > 0 ? "warn" : "neutral"}
            href={`/${slug}/admin/autorizaciones`}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Incidentes
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Reportados / mes"
            value={issuesTotal}
            href={`/${slug}/admin/incidentes`}
          />
          <KpiCard
            label="Abiertos"
            value={issuesOpenCount}
            tone={issuesOpenCount > 0 ? "warn" : "neutral"}
            href={`/${slug}/admin/incidentes?status=open`}
          />
          <KpiCard
            label="Resueltos"
            value={issuesResolvedCount}
            tone="positive"
            href={`/${slug}/admin/incidentes?status=resolved`}
          />
          <KpiCard
            label="Críticos / mes"
            value={criticalIssues}
            tone={criticalIssues > 0 ? "warn" : "neutral"}
            href={`/${slug}/admin/incidentes?kind=panic`}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiCard
            label="Tiempo medio a resolución"
            value={avgIssueHours !== null ? formatHours(avgIssueHours) : "—"}
            hint="últimos 30 días"
            href={`/${slug}/admin/incidentes?status=resolved`}
          />
          <KpiCard
            label="Muestras"
            value={avgIssueResolution.length}
            hint="incidentes con timestamp"
            href={`/${slug}/admin/incidentes?status=resolved`}
          />
        </div>
        {issuesByKind.length > 0 && (
          <div className="mt-6">
            <RankingCard
              title="Incidentes por tipo"
              rows={issuesByKind.map((g) => ({
                label: ISSUE_KIND_LABEL[g.kind] ?? g.kind,
                count: g._count._all,
                href: `/${slug}/admin/incidentes?kind=${g.kind}`,
              }))}
              totalForBars={issuesByKind[0]!._count._all}
            />
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Comunicación
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Avisos / mes"
            value={broadcastsMonth}
            href={`/${slug}/admin/avisos`}
          />
          <KpiCard
            label="Últ. destinatarios"
            value={lastBroadcast?.recipientCount ?? 0}
            hint={lastBroadcast?.sentAt.toLocaleDateString("es-AR") ?? "sin avisos"}
            href={`/${slug}/admin/avisos`}
          />
          <KpiCard
            label="Reglamento (FAQ)"
            value={faqCount}
            hint="preguntas cargadas"
            href={`/${slug}/admin/reglamento`}
          />
          <KpiCard
            label="Objetos perdidos"
            value={lostByStatus("lost")}
            hint={`${lostByStatus("claimed")} retirados · ${lostByStatus("disposed")} descartados`}
            tone={lostByStatus("lost") > 0 ? "warn" : "neutral"}
            href={`/${slug}/admin/objetos?status=lost`}
          />
        </div>
      </section>
    </div>
  );
}

function formatHours(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

function RankingCard({
  title,
  rows,
  totalForBars,
}: {
  title: string;
  rows: Array<{ label: string; count: number; href?: string }>;
  totalForBars: number;
}) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-400">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">Sin datos este mes.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, i) => {
            const pct = Math.max(8, Math.round((row.count / totalForBars) * 100));
            const content = (
              <>
                <span className="w-6 text-right font-mono text-xs text-ink-500">
                  {i + 1}
                </span>
                <div className="flex flex-1 items-center gap-3">
                  <span className="min-w-[80px] truncate text-sm text-ink-200">
                    {row.label}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-ink-900">
                    <div
                      className="h-2 rounded-full bg-accent/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-sm tabular-nums text-ink-300">
                    {row.count}
                  </span>
                </div>
              </>
            );
            return (
              <li key={`${row.label}-${i}`}>
                {row.href ? (
                  <a
                    href={row.href}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-ink-800"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="flex items-center gap-3">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
