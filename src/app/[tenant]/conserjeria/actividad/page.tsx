import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";

type Scope = "todos" | "mio";
type EntityKey =
  | "todo"
  | "paquetes"
  | "visitas"
  | "incidentes"
  | "autorizaciones"
  | "vacaciones"
  | "avisos"
  | "objetos";

type Tone = "accent" | "positive" | "critical" | "warn" | "neutral";

const TONE_STYLES: Record<Tone, string> = {
  accent: "border-accent/40 bg-accent/10 text-accent",
  positive: "border-positive/40 bg-positive/10 text-positive",
  critical: "border-critical/40 bg-critical/10 text-critical",
  warn: "border-warn/40 bg-warn/10 text-warn",
  neutral: "border-ink-700 bg-ink-800 text-ink-300",
};

// One action -> one row meta. The entity field tells us which Prisma table to
// hydrate from for context (unit label, code, name, etc.).
const ACTION_META: Record<
  string,
  { label: string; tone: Tone; entity: Exclude<EntityKey, "todo"> }
> = {
  "package.registered": { label: "Paquete recibido", tone: "accent", entity: "paquetes" },
  "package.picked_up": { label: "Paquete entregado", tone: "positive", entity: "paquetes" },
  "package.cancelled": { label: "Paquete cancelado", tone: "critical", entity: "paquetes" },
  "visitor.announced": { label: "Visita anunciada", tone: "accent", entity: "visitas" },
  "door.confirmed": { label: "Visita aprobada", tone: "positive", entity: "visitas" },
  "door.rejected": { label: "Visita rechazada", tone: "critical", entity: "visitas" },
  "issue.reported": { label: "Incidente reportado", tone: "warn", entity: "incidentes" },
  "issue.acknowledged": { label: "Incidente visto", tone: "accent", entity: "incidentes" },
  "issue.resolved": { label: "Incidente resuelto", tone: "positive", entity: "incidentes" },
  "recurring_auth.created": {
    label: "Autorización fija creada",
    tone: "accent",
    entity: "autorizaciones",
  },
  "recurring_auth.paused": {
    label: "Autorización pausada",
    tone: "neutral",
    entity: "autorizaciones",
  },
  "recurring_auth.revoked": {
    label: "Autorización revocada",
    tone: "critical",
    entity: "autorizaciones",
  },
  "user.vacation_set": { label: "Vacaciones iniciadas", tone: "accent", entity: "vacaciones" },
  "user.vacation_cleared": {
    label: "Vacaciones terminadas",
    tone: "positive",
    entity: "vacaciones",
  },
  "broadcast.sent": { label: "Aviso enviado", tone: "accent", entity: "avisos" },
  "lost_found.posted": { label: "Objeto cargado", tone: "accent", entity: "objetos" },
  "lost_found.claimed": { label: "Objeto retirado", tone: "positive", entity: "objetos" },
  "lost_found.disposed": { label: "Objeto descartado", tone: "neutral", entity: "objetos" },
};

const ENTITY_ACTIONS: Record<Exclude<EntityKey, "todo">, string[]> = {
  paquetes: ["package.registered", "package.picked_up", "package.cancelled"],
  visitas: ["visitor.announced", "door.confirmed", "door.rejected"],
  incidentes: ["issue.reported", "issue.acknowledged", "issue.resolved"],
  autorizaciones: [
    "recurring_auth.created",
    "recurring_auth.paused",
    "recurring_auth.revoked",
  ],
  vacaciones: ["user.vacation_set", "user.vacation_cleared"],
  avisos: ["broadcast.sent"],
  objetos: ["lost_found.posted", "lost_found.claimed", "lost_found.disposed"],
};

const ENTITY_TYPE: Record<Exclude<EntityKey, "todo">, string> = {
  paquetes: "Package",
  visitas: "VisitorEvent",
  incidentes: "Issue",
  autorizaciones: "RecurringAuthorization",
  vacaciones: "User",
  avisos: "Broadcast",
  objetos: "LostFoundItem",
};

const ALL_TRACKED_ACTIONS = Object.keys(ACTION_META);

const ENTITY_LABEL: Record<Exclude<EntityKey, "todo">, string> = {
  paquetes: "Paquetes",
  visitas: "Visitas",
  incidentes: "Incidentes",
  autorizaciones: "Autorizaciones",
  vacaciones: "Vacaciones",
  avisos: "Avisos",
  objetos: "Objetos",
};

const ENTITY_TONE: Record<Exclude<EntityKey, "todo">, Tone> = {
  paquetes: "accent",
  visitas: "accent",
  incidentes: "warn",
  autorizaciones: "accent",
  vacaciones: "neutral",
  avisos: "accent",
  objetos: "neutral",
};

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
  const entity: EntityKey =
    rawTipo && rawTipo !== "todo" && rawTipo in ENTITY_ACTIONS
      ? (rawTipo as EntityKey)
      : "todo";

  const actionFilter =
    entity === "todo" ? ALL_TRACKED_ACTIONS : ENTITY_ACTIONS[entity];

  // Operational feed: today only. Historical data lives in the admin pages.
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const events = await prisma.auditLog.findMany({
    where: {
      tenantId: tenant.id,
      action: { in: actionFilter },
      at: { gte: startOfDay, lte: endOfDay },
      ...(scope === "mio" ? { actorUserId: session.userId } : {}),
    },
    orderBy: { at: "desc" },
    take: 100,
    select: {
      id: true,
      at: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      actor: { select: { id: true, name: true, role: true } },
    },
  });

  const hydrated = await hydrate(tenant.id, events);

  const counts = await prisma.auditLog.groupBy({
    by: ["action"],
    where: {
      tenantId: tenant.id,
      action: { in: ALL_TRACKED_ACTIONS },
      at: { gte: startOfDay, lte: endOfDay },
      ...(scope === "mio" ? { actorUserId: session.userId } : {}),
    },
    _count: { action: true },
  });
  const countByAction = new Map(counts.map((c) => [c.action, c._count.action]));
  const countByEntity = new Map<EntityKey, number>();
  for (const [key, actions] of Object.entries(ENTITY_ACTIONS) as [
    Exclude<EntityKey, "todo">,
    string[],
  ][]) {
    const total = actions.reduce((sum, a) => sum + (countByAction.get(a) ?? 0), 0);
    countByEntity.set(key, total);
  }
  const totalAll = [...countByEntity.values()].reduce((a, b) => a + b, 0);

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
          <h1 className="text-xl font-bold tracking-tight">Actividad de hoy</h1>
          <p className="text-[11px] text-ink-500">
            {now.toLocaleDateString("es-AR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}{" "}
            · ¿Buscás algo más viejo? Andá a Administración.
          </p>
        </div>
      </header>

      <ScopeToggle slug={slug} scope={scope} entity={entity} />

      <EntityFilter
        slug={slug}
        scope={scope}
        entity={entity}
        countByEntity={countByEntity}
        totalAll={totalAll}
      />

      {events.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          {scope === "mio"
            ? "Todavía no registraste actividad hoy."
            : "Sin movimientos hoy para este filtro."}
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {events.map((e) => {
            const meta = ACTION_META[e.action];
            if (!meta) return null;
            const isMine = e.actor?.id === session.userId;
            const ctx = hydrated.get(`${e.entityType}:${e.entityId}`);
            return (
              <li
                key={e.id}
                className={
                  "rounded-2xl border bg-ink-850 px-4 py-3 transition-colors " +
                  (isMine ? "border-accent/30" : "border-ink-700")
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${TONE_STYLES[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                    {ctx?.primary && (
                      <span className="text-sm font-medium text-ink-100">{ctx.primary}</span>
                    )}
                  </div>
                  <time className="font-mono text-[11px] text-ink-400" dateTime={e.at.toISOString()}>
                    {formatTime(e.at)}
                  </time>
                </div>
                {(ctx?.secondary || e.actor) && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
                    {ctx?.secondary && <span>{ctx.secondary}</span>}
                    <span className="text-ink-500">
                      {ctx?.secondary && "· "}
                      por <span className={isMine ? "text-accent" : "text-ink-300"}>
                        {e.actor?.name ?? "—"}
                      </span>
                      {isMine && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-accent">
                          vos
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {ctx?.detail && (
                  <p className="mt-2 rounded-lg bg-ink-900 px-3 py-1.5 text-xs text-ink-300">
                    {ctx.detail}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {events.length === 100 && (
        <p className="mt-4 text-center text-[11px] text-ink-500">
          Día muy activo: mostrando los 100 movimientos más recientes
        </p>
      )}
    </main>
  );
}

interface HydratedRow {
  primary?: string; // bold subject (e.g. "Depto 5C", visitor name, issue title)
  secondary?: string; // dim line (e.g. carrier, code, kind, recipient count)
  detail?: string; // boxed extra line (e.g. cancellation reason)
}

// Fan out one query per entity type and stitch rows back together by id.
async function hydrate(
  tenantId: string,
  events: Array<{ entityType: string; entityId: string; action: string; metadata: unknown }>,
): Promise<Map<string, HydratedRow>> {
  const byType = new Map<string, Set<string>>();
  for (const e of events) {
    if (!byType.has(e.entityType)) byType.set(e.entityType, new Set());
    byType.get(e.entityType)!.add(e.entityId);
  }
  const idsOf = (t: string) => [...(byType.get(t) ?? [])];

  const [packages, visitors, issues, recurring, broadcasts, lostFound, users] = await Promise.all([
    idsOf("Package").length
      ? prisma.package.findMany({
          where: { id: { in: idsOf("Package") }, tenantId },
          select: {
            id: true,
            pickupCode: true,
            carrier: true,
            unit: { select: { label: true } },
          },
        })
      : Promise.resolve([]),
    idsOf("VisitorEvent").length
      ? prisma.visitorEvent.findMany({
          where: { id: { in: idsOf("VisitorEvent") }, tenantId },
          select: {
            id: true,
            visitorName: true,
            vehiclePlate: true,
            unit: { select: { label: true } },
          },
        })
      : Promise.resolve([]),
    idsOf("Issue").length
      ? prisma.issue.findMany({
          where: { id: { in: idsOf("Issue") }, tenantId },
          select: {
            id: true,
            kind: true,
            title: true,
            severity: true,
            unit: { select: { label: true } },
          },
        })
      : Promise.resolve([]),
    idsOf("RecurringAuthorization").length
      ? prisma.recurringAuthorization.findMany({
          where: { id: { in: idsOf("RecurringAuthorization") }, tenantId },
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            unit: { select: { label: true } },
          },
        })
      : Promise.resolve([]),
    idsOf("Broadcast").length
      ? prisma.broadcast.findMany({
          where: { id: { in: idsOf("Broadcast") }, tenantId },
          select: { id: true, subject: true, recipientCount: true },
        })
      : Promise.resolve([]),
    idsOf("LostFoundItem").length
      ? prisma.lostFoundItem.findMany({
          where: { id: { in: idsOf("LostFoundItem") }, tenantId },
          select: { id: true, description: true, foundLocation: true },
        })
      : Promise.resolve([]),
    idsOf("User").length
      ? prisma.user.findMany({
          where: { id: { in: idsOf("User") }, tenantId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const out = new Map<string, HydratedRow>();

  for (const p of packages) {
    out.set(`Package:${p.id}`, {
      primary: `Depto ${p.unit.label}`,
      secondary: [p.carrier, p.pickupCode].filter(Boolean).join(" · "),
    });
  }
  for (const v of visitors) {
    const plate = v.vehiclePlate ? ` · patente ${v.vehiclePlate}` : "";
    out.set(`VisitorEvent:${v.id}`, {
      primary: v.visitorName,
      secondary: `Depto ${v.unit.label}${plate}`,
    });
  }
  for (const i of issues) {
    const unit = i.unit ? `Depto ${i.unit.label}` : "Edificio";
    const sev = i.severity === "critical" ? " · crítico" : i.severity === "high" ? " · alta" : "";
    out.set(`Issue:${i.id}`, {
      primary: i.title,
      secondary: `${ISSUE_KIND[i.kind] ?? i.kind} · ${unit}${sev}`,
    });
  }
  for (const r of recurring) {
    out.set(`RecurringAuthorization:${r.id}`, {
      primary: r.name,
      secondary: `Depto ${r.unit.label} · ${r.startTime}–${r.endTime}`,
    });
  }
  for (const b of broadcasts) {
    out.set(`Broadcast:${b.id}`, {
      primary: b.subject,
      secondary: `${b.recipientCount} ${b.recipientCount === 1 ? "destinatario" : "destinatarios"}`,
    });
  }
  for (const l of lostFound) {
    out.set(`LostFoundItem:${l.id}`, {
      primary: l.description,
      secondary: l.foundLocation ?? undefined,
    });
  }
  for (const u of users) {
    out.set(`User:${u.id}`, { primary: u.name });
  }

  // Action-specific detail strings (cancel reason, resolution note, vacation dates).
  for (const e of events) {
    const meta =
      typeof e.metadata === "object" && e.metadata !== null
        ? (e.metadata as Record<string, unknown>)
        : null;
    if (!meta) continue;
    const key = `${e.entityType}:${e.entityId}`;
    const existing = out.get(key) ?? {};

    if (e.action === "package.cancelled" && typeof meta.reason === "string") {
      out.set(key, { ...existing, detail: `Motivo: ${meta.reason}` });
    } else if (e.action === "issue.resolved" && typeof meta.note === "string") {
      out.set(key, { ...existing, detail: `Resolución: ${meta.note}` });
    } else if (e.action === "user.vacation_set" && typeof meta.start === "string" && typeof meta.end === "string") {
      const s = new Date(meta.start).toLocaleDateString("es-AR");
      const en = new Date(meta.end).toLocaleDateString("es-AR");
      out.set(key, { ...existing, secondary: `${existing.secondary ?? ""}`.trim(), detail: `${s} → ${en}` });
    }
  }

  return out;
}

const ISSUE_KIND: Record<string, string> = {
  maintenance: "Mantenimiento",
  noise: "Ruido",
  suspicious: "Sospechoso",
  panic: "Pánico",
  incident: "Incidente",
};

function ScopeToggle({
  slug,
  scope,
  entity,
}: {
  slug: string;
  scope: Scope;
  entity: EntityKey;
}) {
  const base = `/${slug}/conserjeria/actividad`;
  const tipoQ = entity !== "todo" ? `&tipo=${entity}` : "";
  return (
    <div className="mb-3 inline-flex rounded-2xl border border-ink-700 bg-ink-850 p-1">
      <ToggleLink href={`${base}?scope=todos${tipoQ}`} active={scope === "todos"} label="Todo el equipo" />
      <ToggleLink href={`${base}?scope=mio${tipoQ}`} active={scope === "mio"} label="Sólo lo mío" />
    </div>
  );
}

function EntityFilter({
  slug,
  scope,
  entity,
  countByEntity,
  totalAll,
}: {
  slug: string;
  scope: Scope;
  entity: EntityKey;
  countByEntity: Map<EntityKey, number>;
  totalAll: number;
}) {
  const base = `/${slug}/conserjeria/actividad`;
  const scopeQ = scope === "mio" ? "scope=mio" : "scope=todos";
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        <Chip href={`${base}?${scopeQ}`} active={entity === "todo"} label="Todo" count={totalAll} />
        {(Object.keys(ENTITY_ACTIONS) as Exclude<EntityKey, "todo">[]).map((key) => (
          <Chip
            key={key}
            href={`${base}?${scopeQ}&tipo=${key}`}
            active={entity === key}
            label={ENTITY_LABEL[key]}
            count={countByEntity.get(key) ?? 0}
            tone={ENTITY_TONE[key]}
          />
        ))}
      </div>
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
  tone?: Tone;
}) {
  const activeStyles = tone ? TONE_STYLES[tone] : "border-ink-500 bg-ink-700 text-ink-100";
  return (
    <Link
      href={href}
      className={
        active
          ? `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${activeStyles}`
          : "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:text-ink-100"
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
