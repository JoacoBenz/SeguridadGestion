import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
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

  const session = await getSession();
  const isGuardOnly = session?.role === "guard";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const todayDow = now.getDay();

  const [
    pending,
    stale,
    receivedThisMonth,
    pickedUpThisMonth,
    unitCount,
    residentCount,
    guardCount,
    visitorsToday,
    activeRecurring,
    recurringToday,
    issuesOpen,
    issuesCritical,
    broadcastsMonth,
    residentsOnVacation,
    lostFoundOpen,
    faqCount,
  ] = await Promise.all([
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
    prisma.user.count({ where: { tenantId: tenant.id, role: "resident" } }),
    prisma.user.count({ where: { tenantId: tenant.id, role: "guard" } }),
    prisma.visitorEvent.count({
      where: {
        tenantId: tenant.id,
        status: { in: ["pending", "confirmed"] },
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
    prisma.recurringAuthorization.count({
      where: { tenantId: tenant.id, status: "active" },
    }),
    prisma.recurringAuthorization.count({
      where: {
        tenantId: tenant.id,
        status: "active",
        daysOfWeek: { has: todayDow },
        OR: [{ validUntil: null }, { validUntil: { gte: startOfDay } }],
      },
    }),
    prisma.issue.count({
      where: {
        tenantId: tenant.id,
        status: { in: ["open", "acknowledged"] },
      },
    }),
    prisma.issue.count({
      where: {
        tenantId: tenant.id,
        severity: "critical",
        status: { in: ["open", "acknowledged"] },
      },
    }),
    prisma.broadcast.count({
      where: { tenantId: tenant.id, sentAt: { gte: startOfMonth } },
    }),
    prisma.user.count({
      where: {
        tenantId: tenant.id,
        role: "resident",
        vacationStart: { not: null },
      },
    }),
    prisma.lostFoundItem.count({
      where: { tenantId: tenant.id, status: "lost" },
    }),
    prisma.faqEntry.count({ where: { tenantId: tenant.id } }),
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
            href={`/${slug}/admin/paquetes`}
          />
          <KpiCard
            label=">3 días"
            value={stale}
            tone={stale > 0 ? "warn" : "neutral"}
            hint={stale > 0 ? "necesitan recordatorio" : ""}
            href={`/${slug}/admin/paquetes`}
          />
          <KpiCard
            label="Recibidos / mes"
            value={receivedThisMonth}
            hint={`desde ${startOfMonth.toLocaleDateString("es-AR")}`}
            href={`/${slug}/admin/paquetes`}
          />
          <KpiCard
            label="Retirados / mes"
            value={pickedUpThisMonth}
            tone="positive"
            href={`/${slug}/admin/paquetes`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Hoy en conserjería
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Visitas hoy"
            value={visitorsToday}
            tone={visitorsToday > 0 ? "accent" : "neutral"}
            href={`/${slug}/conserjeria`}
          />
          <KpiCard
            label="Autorizaciones fijas hoy"
            value={recurringToday}
            hint={`${activeRecurring} activas en total`}
            href={`/${slug}/admin/autorizaciones`}
          />
          <KpiCard
            label="Incidentes abiertos"
            value={issuesOpen}
            tone={issuesCritical > 0 ? "warn" : issuesOpen > 0 ? "accent" : "neutral"}
            hint={issuesCritical > 0 ? `${issuesCritical} crítico${issuesCritical === 1 ? "" : "s"}` : ""}
            href={`/${slug}/admin/incidentes?status=open`}
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
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Comunicación
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {!isGuardOnly && (
            <>
              <KpiCard
                label="Avisos / mes"
                value={broadcastsMonth}
                href={`/${slug}/admin/avisos`}
              />
              <KpiCard
                label="Reglamento"
                value={faqCount}
                hint="preguntas cargadas"
                href={`/${slug}/admin/reglamento`}
              />
            </>
          )}
          <KpiCard
            label="Objetos perdidos"
            value={lostFoundOpen}
            tone={lostFoundOpen > 0 ? "warn" : "neutral"}
            hint={lostFoundOpen > 0 ? "sin reclamar" : ""}
            href={`/${slug}/admin/objetos?status=lost`}
          />
        </div>
      </section>

      {!isGuardOnly && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
            Edificio
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Unidades" value={unitCount} href={`/${slug}/admin/unidades`} />
            <KpiCard label="Residentes" value={residentCount} href={`/${slug}/admin/residentes`} />
            <KpiCard
              label="Guardias"
              value={guardCount}
              tone={guardCount === 0 ? "warn" : "neutral"}
              hint={guardCount === 0 ? "agregá personal" : ""}
              href={`/${slug}/admin/personal`}
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!isGuardOnly && (
            <>
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
                href={`/${slug}/admin/personal`}
                title="Personal de conserjería"
                hint={`${guardCount} ${guardCount === 1 ? "guardia" : "guardias"}`}
              />
            </>
          )}
          <QuickAction
            href={`/${slug}/admin/paquetes`}
            title="Historial de paquetes"
            hint="ver, filtrar, cancelar"
          />
          <QuickAction
            href={`/${slug}/admin/autorizaciones`}
            title="Autorizaciones"
            hint={`${activeRecurring} fijas · ${residentsOnVacation} en vacaciones`}
          />
          <QuickAction
            href={`/${slug}/admin/incidentes`}
            title="Incidentes"
            hint={issuesOpen > 0 ? `${issuesOpen} abierto${issuesOpen === 1 ? "" : "s"}` : "todo resuelto"}
          />
          {!isGuardOnly && (
            <>
              <QuickAction
                href={`/${slug}/admin/avisos`}
                title="Avisos"
                hint={`${broadcastsMonth} enviado${broadcastsMonth === 1 ? "" : "s"} este mes`}
              />
              <QuickAction
                href={`/${slug}/admin/reglamento`}
                title="Reglamento (FAQ)"
                hint={`${faqCount} pregunta${faqCount === 1 ? "" : "s"}`}
              />
            </>
          )}
          <QuickAction
            href={`/${slug}/admin/objetos`}
            title="Objetos perdidos"
            hint={`${lostFoundOpen} sin reclamar`}
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
