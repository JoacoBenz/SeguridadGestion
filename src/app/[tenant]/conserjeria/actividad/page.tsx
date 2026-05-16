import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";

type Scope = "todos" | "mio";
type Tipo = "todo" | "recibido" | "entregado" | "cancelado";

const ACTION_BY_TIPO: Record<Exclude<Tipo, "todo">, string> = {
  recibido: "package.registered",
  entregado: "package.picked_up",
  cancelado: "package.cancelled",
};

const LABEL_BY_ACTION: Record<string, { label: string; tone: "accent" | "positive" | "critical" }> = {
  "package.registered": { label: "Recibido", tone: "accent" },
  "package.picked_up": { label: "Entregado", tone: "positive" },
  "package.cancelled": { label: "Cancelado", tone: "critical" },
};

const TONE_STYLES = {
  accent: "border-accent/40 bg-accent/10 text-accent",
  positive: "border-positive/40 bg-positive/10 text-positive",
  critical: "border-critical/40 bg-critical/10 text-critical",
} as const;

export default async function ActividadPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ scope?: string; tipo?: string }>;
}) {
  const { tenant: slug } = await params;
  const { scope: rawScope, tipo: rawTipo } = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  const session = await requireTenantRoleOrRedirect(
    tenant.id,
    ["guard", "admin"],
    `/${slug}/conserjeria/actividad`,
  );

  const scope: Scope = rawScope === "mio" ? "mio" : "todos";
  const tipo: Tipo =
    rawTipo === "recibido" || rawTipo === "entregado" || rawTipo === "cancelado"
      ? rawTipo
      : "todo";

  const actionFilter =
    tipo === "todo"
      ? { in: Object.values(ACTION_BY_TIPO) }
      : ACTION_BY_TIPO[tipo];

  const events = await prisma.auditLog.findMany({
    where: {
      tenantId: tenant.id,
      entityType: "Package",
      action: typeof actionFilter === "string" ? actionFilter : { in: actionFilter.in },
      ...(scope === "mio" ? { actorUserId: session.userId } : {}),
    },
    orderBy: { at: "desc" },
    take: 100,
    select: {
      id: true,
      at: true,
      action: true,
      entityId: true,
      metadata: true,
      actor: { select: { id: true, name: true, role: true } },
    },
  });

  const pkgIds = Array.from(new Set(events.map((e) => e.entityId)));
  const pkgs = await prisma.package.findMany({
    where: { id: { in: pkgIds }, tenantId: tenant.id },
    select: {
      id: true,
      pickupCode: true,
      carrier: true,
      unit: { select: { label: true } },
    },
  });
  const pkgMap = new Map(pkgs.map((p) => [p.id, p]));

  const counts = await prisma.auditLog.groupBy({
    by: ["action"],
    where: {
      tenantId: tenant.id,
      entityType: "Package",
      action: { in: Object.values(ACTION_BY_TIPO) },
      ...(scope === "mio" ? { actorUserId: session.userId } : {}),
    },
    _count: { action: true },
  });
  const countByAction = new Map(counts.map((c) => [c.action, c._count.action]));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-12 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href={`/${slug}/conserjeria`}
          aria-label="Volver"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 text-ink-300 transition-colors hover:text-ink-100"
        >
          ←
        </Link>
        <div className="flex-1">
          <p className="text-xs text-ink-400">{tenant.name}</p>
          <h1 className="text-xl font-bold tracking-tight">Actividad</h1>
        </div>
      </header>

      <ScopeToggle slug={slug} scope={scope} tipo={tipo} />

      <TipoFilter
        slug={slug}
        scope={scope}
        tipo={tipo}
        countByAction={countByAction}
      />

      {events.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          {scope === "mio"
            ? "Todavía no registraste ni entregaste paquetes."
            : "Sin movimientos para este filtro."}
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {events.map((e) => {
            const meta = LABEL_BY_ACTION[e.action] ?? { label: e.action, tone: "accent" as const };
            const pkg = pkgMap.get(e.entityId);
            const isMine = e.actor?.id === session.userId;
            const reason =
              e.action === "package.cancelled" && typeof e.metadata === "object" && e.metadata !== null
                ? (e.metadata as { reason?: string }).reason ?? null
                : null;
            return (
              <li
                key={e.id}
                className={
                  "rounded-2xl border bg-ink-850 px-4 py-3 transition-colors " +
                  (isMine ? "border-accent/30" : "border-ink-700")
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${TONE_STYLES[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                    {pkg && (
                      <span className="text-sm font-medium text-ink-100">
                        Depto <span className="font-mono">{pkg.unit.label}</span>
                      </span>
                    )}
                  </div>
                  <time className="font-mono text-[11px] text-ink-400" dateTime={e.at.toISOString()}>
                    {formatTime(e.at)}
                  </time>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
                  {pkg?.pickupCode && (
                    <span className="font-mono text-accent">{pkg.pickupCode}</span>
                  )}
                  {pkg?.carrier && <span>· {pkg.carrier}</span>}
                  <span className="text-ink-500">
                    · por <span className={isMine ? "text-accent" : "text-ink-300"}>
                      {e.actor?.name ?? "—"}
                    </span>
                    {isMine && <span className="ml-1 text-[10px] uppercase tracking-wider text-accent">vos</span>}
                  </span>
                </div>
                {reason && (
                  <p className="mt-2 rounded-lg bg-ink-900 px-3 py-1.5 text-xs text-ink-300">
                    Motivo: {reason}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {events.length === 100 && (
        <p className="mt-4 text-center text-[11px] text-ink-500">
          Mostrando los 100 movimientos más recientes
        </p>
      )}
    </main>
  );
}

function ScopeToggle({ slug, scope, tipo }: { slug: string; scope: Scope; tipo: Tipo }) {
  const base = `/${slug}/conserjeria/actividad`;
  const todosHref = `${base}?scope=todos${tipo !== "todo" ? `&tipo=${tipo}` : ""}`;
  const mioHref = `${base}?scope=mio${tipo !== "todo" ? `&tipo=${tipo}` : ""}`;
  return (
    <div className="mb-3 inline-flex rounded-2xl border border-ink-700 bg-ink-850 p-1">
      <ToggleLink href={todosHref} active={scope === "todos"} label="Todo el equipo" />
      <ToggleLink href={mioHref} active={scope === "mio"} label="Sólo lo mío" />
    </div>
  );
}

function TipoFilter({
  slug,
  scope,
  tipo,
  countByAction,
}: {
  slug: string;
  scope: Scope;
  tipo: Tipo;
  countByAction: Map<string, number>;
}) {
  const base = `/${slug}/conserjeria/actividad`;
  const scopeQ = scope === "mio" ? "scope=mio" : "scope=todos";
  const total =
    (countByAction.get("package.registered") ?? 0) +
    (countByAction.get("package.picked_up") ?? 0) +
    (countByAction.get("package.cancelled") ?? 0);
  return (
    <div className="flex flex-wrap gap-2">
      <Chip href={`${base}?${scopeQ}`} active={tipo === "todo"} label="Todo" count={total} />
      <Chip
        href={`${base}?${scopeQ}&tipo=recibido`}
        active={tipo === "recibido"}
        label="Recibidos"
        count={countByAction.get("package.registered") ?? 0}
        tone="accent"
      />
      <Chip
        href={`${base}?${scopeQ}&tipo=entregado`}
        active={tipo === "entregado"}
        label="Entregados"
        count={countByAction.get("package.picked_up") ?? 0}
        tone="positive"
      />
      <Chip
        href={`${base}?${scopeQ}&tipo=cancelado`}
        active={tipo === "cancelado"}
        label="Cancelados"
        count={countByAction.get("package.cancelled") ?? 0}
        tone="critical"
      />
    </div>
  );
}

function ToggleLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-fg"
          : "rounded-xl px-4 py-2 text-xs font-medium text-ink-300 transition-colors hover:text-ink-100"
      }
    >
      {label}
    </Link>
  );
}

function Chip({
  href,
  active,
  label,
  count,
  tone,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone?: "accent" | "positive" | "critical";
}) {
  const activeStyles = tone ? TONE_STYLES[tone] : "border-ink-500 bg-ink-700 text-ink-100";
  return (
    <Link
      href={href}
      className={
        active
          ? `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${activeStyles}`
          : "inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:text-ink-100"
      }
    >
      {label}
      <span className="font-mono text-[10px] opacity-70">{count}</span>
    </Link>
  );
}

function formatTime(d: Date): string {
  const now = Date.now();
  const ms = now - d.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} d`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
