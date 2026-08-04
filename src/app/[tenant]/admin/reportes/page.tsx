import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { KpiCard } from "@/components/admin/kpi-card";
import { formatDate } from "@/lib/datetime";
import { buildMonthlyReport } from "@/server/admin/reports";

export default async function ReportesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, timezone: true },
  });
  if (!tenant) notFound();

  // Las pages no pueden delegar el auth al layout (renderizan en paralelo).
  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin/reportes`);

  const report = await buildMonthlyReport(tenant.id, tenant.timezone);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-xl font-bold">Reportes</h2>
        <p className="text-xs text-ink-400">
          Datos desde {formatDate(report.startOfMonth, tenant.timezone)}
        </p>
      </header>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Mes en curso
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Recibidos" value={report.received} />
          <KpiCard label="Retirados" value={report.pickedUpThisMonth} tone="positive" />
          <KpiCard label="Cancelados" value={report.cancelled} tone="neutral" />
          <KpiCard
            label="% retirados"
            value={report.pickupRate !== null ? `${report.pickupRate}%` : "—"}
            hint={`${report.pickedUpFromCohort} de ${report.received} recibidos`}
            tone={report.pickupRate !== null && report.pickupRate >= 80 ? "positive" : "neutral"}
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
            value={report.avgHoursToPickup !== null ? formatHours(report.avgHoursToPickup) : "—"}
            hint="últimos 30 días (hasta 200 muestras)"
          />
          <KpiCard
            label="Pendientes >3 días"
            value={report.stalePending}
            hint="candidatos a recordatorio"
            tone={report.stalePending > 0 ? "neutral" : "positive"}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankingCard
          title="Top transportistas"
          rows={report.topCarriers}
          totalForBars={report.topCarriers[0]?.count ?? 1}
        />
        <RankingCard
          title="Deptos con más actividad"
          rows={report.topUnits}
          totalForBars={report.topUnits[0]?.count ?? 1}
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
