import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { createUnitAction, deleteUnitAction } from "@/server/admin/units";

export default async function UnidadesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error, ok } = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    orderBy: { label: "asc" },
    include: {
      _count: { select: { residents: true, packages: true } },
    },
  });

  const create = createUnitAction.bind(null, slug);
  const remove = deleteUnitAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Unidades</h2>
        <p className="text-xs text-ink-400">{units.length} cargadas</p>
      </header>

      {ok && <SuccessBanner text={ok === "creada" ? "Unidad creada" : "Unidad borrada"} />}
      {error && <ErrorBanner text={error} />}

      <form action={create} className="flex flex-col gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Label
          </span>
          <input
            name="label"
            required
            placeholder="3B"
            maxLength={20}
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-[2] flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Notas (opcional)
          </span>
          <input
            name="notes"
            placeholder="Piso entero, contramano…"
            maxLength={200}
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Agregar
        </button>
      </form>

      {units.length === 0 ? (
        <EmptyState text="Todavía no cargaste unidades." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {units.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-4">
                <span className="font-mono text-2xl font-bold text-ink-100">{u.label}</span>
                <div className="text-xs text-ink-400">
                  <p>{u._count.residents} residente{u._count.residents === 1 ? "" : "s"}</p>
                  <p>{u._count.packages} paquete{u._count.packages === 1 ? "" : "s"} histórico{u._count.packages === 1 ? "" : "s"}</p>
                </div>
              </div>
              <form action={remove}>
                <input type="hidden" name="unitId" value={u.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition-colors hover:border-critical/60 hover:text-critical"
                >
                  Borrar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SuccessBanner({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
      {text}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
      {text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
      {text}
    </div>
  );
}
