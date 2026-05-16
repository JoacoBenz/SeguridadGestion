import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { acknowledgeIssueAction, resolveIssueAction } from "@/server/admin/issues";
import type { IssueKind, IssueStatus } from "@prisma/client";

const OK_MESSAGES: Record<string, string> = {
  visto: "Incidente marcado como visto",
  resuelto: "Incidente resuelto",
};

const KIND_LABEL: Record<IssueKind, string> = {
  maintenance: "Mantenimiento",
  noise: "Ruido",
  suspicious: "Sospechoso",
  panic: "🚨 Pánico",
  incident: "Incidente",
};

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Abierto",
  acknowledged: "Visto",
  resolved: "Resuelto",
};

const STATUS_TONE: Record<IssueStatus, string> = {
  open: "border-warn/40 bg-warn/10 text-warn",
  acknowledged: "border-accent/40 bg-accent/10 text-accent",
  resolved: "border-positive/40 bg-positive/10 text-positive",
};

export default async function IncidentesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string; ok?: string; kind?: string; status?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error, ok, kind: kindFilter, status: statusFilter } = await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const where: Parameters<typeof prisma.issue.findMany>[0] = {
    where: { tenantId: tenant.id },
  };
  if (kindFilter && KIND_LABEL[kindFilter as IssueKind]) {
    (where.where as Record<string, unknown>).kind = kindFilter;
  }
  if (statusFilter && STATUS_LABEL[statusFilter as IssueStatus]) {
    (where.where as Record<string, unknown>).status = statusFilter;
  }

  const issues = await prisma.issue.findMany({
    ...where,
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    include: {
      unit: { select: { label: true } },
      reportedBy: { select: { name: true, role: true } },
    },
    take: 100,
  });

  const ack = acknowledgeIssueAction.bind(null, slug);
  const res = resolveIssueAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Incidentes</h2>
        <p className="text-xs text-ink-400">{issues.length} mostrados</p>
      </header>

      {ok && <Banner tone="positive" text={OK_MESSAGES[ok] ?? "Listo"} />}
      {error && <Banner tone="critical" text={error} />}

      <FilterBar slug={slug} activeKind={kindFilter} activeStatus={statusFilter} />

      {issues.length === 0 ? (
        <Empty text="Sin incidentes con esos filtros." />
      ) : (
        <ul className="flex flex-col gap-3">
          {issues.map((it) => (
            <li
              key={it.id}
              className={`flex flex-col gap-3 rounded-2xl border bg-ink-850 p-5 ${
                it.severity === "critical" ? "border-critical/60" : "border-ink-700"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-0.5 ${STATUS_TONE[it.status]}`}>
                      {STATUS_LABEL[it.status]}
                    </span>
                    <span className="rounded-full border border-ink-700 px-2 py-0.5 text-ink-300">
                      {KIND_LABEL[it.kind]}
                    </span>
                    {it.severity === "critical" && (
                      <span className="rounded-full border border-critical/60 bg-critical/10 px-2 py-0.5 text-critical">
                        crítico
                      </span>
                    )}
                    {it.unit && (
                      <span className="rounded-full border border-ink-700 px-2 py-0.5 text-ink-300">
                        unidad {it.unit.label}
                      </span>
                    )}
                  </p>
                  <p className="mt-2 font-semibold text-ink-100">{it.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-300">{it.body}</p>
                  <p className="mt-2 text-xs text-ink-500">
                    Reportado por {it.reportedBy.name} ({it.reportedByRole}) · {it.createdAt.toLocaleString("es-AR")}
                  </p>
                  {it.resolutionNote && (
                    <p className="mt-2 rounded-lg border border-positive/40 bg-positive/10 px-3 py-2 text-xs text-positive">
                      Resolución: {it.resolutionNote}
                    </p>
                  )}
                </div>
              </div>
              {it.status !== "resolved" && (
                <div className="flex flex-wrap items-center gap-2">
                  {it.status === "open" && (
                    <form action={ack}>
                      <input type="hidden" name="issueId" value={it.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:border-accent/60 hover:text-accent"
                      >
                        Marcar visto
                      </button>
                    </form>
                  )}
                  <form action={res} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="issueId" value={it.id} />
                    <input
                      name="note"
                      required
                      placeholder="Nota de resolución…"
                      maxLength={500}
                      className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg"
                    >
                      Resolver
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterBar({
  slug,
  activeKind,
  activeStatus,
}: {
  slug: string;
  activeKind?: string;
  activeStatus?: string;
}) {
  const kindOptions: Array<{ value: string; label: string }> = [
    { value: "", label: "Todos" },
    { value: "maintenance", label: "Mantenimiento" },
    { value: "noise", label: "Ruido" },
    { value: "suspicious", label: "Sospechoso" },
    { value: "panic", label: "Pánico" },
    { value: "incident", label: "Incidente" },
  ];
  const statusOptions: Array<{ value: string; label: string }> = [
    { value: "", label: "Todos" },
    { value: "open", label: "Abiertos" },
    { value: "acknowledged", label: "Vistos" },
    { value: "resolved", label: "Resueltos" },
  ];
  const base = `/${slug}/admin/incidentes`;
  const params = (k: string, s: string) => {
    const q = new URLSearchParams();
    if (k) q.set("kind", k);
    if (s) q.set("status", s);
    return q.toString() ? `?${q.toString()}` : "";
  };
  return (
    <div className="flex flex-col gap-2">
      <FilterRow label="Tipo">
        {kindOptions.map((k) => (
          <a
            key={k.value}
            href={`${base}${params(k.value, activeStatus ?? "")}`}
            className={chipClass((activeKind ?? "") === k.value)}
          >
            {k.label}
          </a>
        ))}
      </FilterRow>
      <FilterRow label="Estado">
        {statusOptions.map((s) => (
          <a
            key={s.value}
            href={`${base}${params(activeKind ?? "", s.value)}`}
            className={chipClass((activeStatus ?? "") === s.value)}
          >
            {s.label}
          </a>
        ))}
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0 text-ink-500">{label}:</span>
      <div className="flex w-max gap-2">{children}</div>
    </div>
  );
}

function chipClass(active: boolean): string {
  return active
    ? "shrink-0 whitespace-nowrap rounded-full border border-accent bg-accent/10 px-3 py-1 text-accent"
    : "shrink-0 whitespace-nowrap rounded-full border border-ink-700 px-3 py-1 text-ink-300 hover:border-ink-500";
}

function Banner({ tone, text }: { tone: "positive" | "critical"; text: string }) {
  const cls =
    tone === "positive"
      ? "border-positive/40 bg-positive/10 text-positive"
      : "border-critical/40 bg-critical/10 text-critical";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{text}</div>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-10 text-center text-sm text-ink-400">
      {text}
    </div>
  );
}
