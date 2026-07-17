import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
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

  // Las pages no pueden delegar el auth al layout (renderizan en paralelo).
  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin/reportes`);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const [received, pickedUp, cancelled, stalePending, topCarriers, topUnits, pickupSamples] = await Promise.all(
    [
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
      prisma.package.count({
        where: {
          tenantId: tenant.id,
          status: "awaiting_pickup",
          receivedAt: { lte: threeDaysAgo },
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
      // Muestra de hasta 200 retiros recientes para promedio de tiempo a retiro.
      prisma.package.findMany({
        where: {
          tenantId: tenant.id,
          status: "picked_up",
          pickedUpAt: { gte: last30, not: null },
        },
        select: { receivedAt: true, pickedUpAt: true },
        take: 200,
      }),
    ],
  );

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
          <KpiCard label="Recibidos" value={received} />
          <KpiCard label="Retirados" value={pickedUp} tone="positive" />
          <KpiCard label="Cancelados" value={cancelled} tone="neutral" />
          <KpiCard
            label="% retirados"
            value={pickupRate !== null ? `${pickupRate}%` : "—"}
            hint="del total recibido"
            tone={pickupRate !== null && pickupRate >= 80 ? "positive" : "neutral"}
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
          />
          <KpiCard
            label="Pendientes >3 días"
            value={stalePending}
            hint="candidatos a recordatorio"
            tone={stalePending > 0 ? "neutral" : "positive"}
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
  rows: Array<{ label: string; count: number }>;
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
            return (
              <li key={`${row.label}-${i}`} className="flex items-center gap-3">
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
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
