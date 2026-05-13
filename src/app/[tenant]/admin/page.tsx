import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { KpiCard } from "@/components/admin/kpi-card";

export default async function AdminDashboard({
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
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const [pending, stale, receivedThisMonth, pickedUpThisMonth, unitCount, residentCount] =
    await Promise.all([
      prisma.package.count({
        where: { tenantId: tenant.id, status: "awaiting_pickup" },
      }),
      prisma.package.count({
        where: {
          tenantId: tenant.id,
          status: "awaiting_pickup",
          receivedAt: { lt: threeDaysAgo },
        },
      }),
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
      prisma.unit.count({ where: { tenantId: tenant.id } }),
      prisma.user.count({
        where: { tenantId: tenant.id, role: "resident" },
      }),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Esta semana
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Pendientes"
            value={pending}
            tone={pending > 0 ? "accent" : "neutral"}
            hint={pending === 0 ? "todo retirado" : ""}
          />
          <KpiCard
            label=">3 días"
            value={stale}
            tone={stale > 0 ? "warn" : "neutral"}
            hint={stale > 0 ? "necesitan recordatorio" : ""}
          />
          <KpiCard
            label="Recibidos / mes"
            value={receivedThisMonth}
            hint={`desde ${startOfMonth.toLocaleDateString("es-AR")}`}
          />
          <KpiCard
            label="Retirados / mes"
            value={pickedUpThisMonth}
            tone="positive"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Edificio
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Unidades" value={unitCount} />
          <KpiCard label="Residentes" value={residentCount} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickAction
            href={`/${slug}/admin/unidades`}
            title="Cargar unidades"
            hint={`${unitCount} cargadas`}
          />
          <QuickAction
            href={`/${slug}/admin/residentes`}
            title="Cargar residentes"
            hint={`${residentCount} cargados`}
          />
          <QuickAction
            href={`/${slug}/admin/paquetes`}
            title="Historial de paquetes"
            hint="ver, filtrar, cancelar"
          />
          <QuickAction
            href={`/${slug}/admin/reportes`}
            title="Reportes"
            hint="actividad mensual"
          />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-ink-700 bg-ink-850 px-5 py-4 transition-colors hover:border-ink-500"
    >
      <div>
        <p className="font-semibold text-ink-100">{title}</p>
        <p className="text-xs text-ink-400">{hint}</p>
      </div>
      <span className="text-ink-500">→</span>
    </Link>
  );
}
