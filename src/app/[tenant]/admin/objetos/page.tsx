import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createLostFoundAction,
  updateLostFoundStatusAction,
} from "@/server/admin/lost-found";
import type { LostFoundStatus } from "@prisma/client";

const STATUS_LABEL: Record<LostFoundStatus, string> = {
  lost: "Sin reclamar",
  claimed: "Retirado",
  disposed: "Descartado",
};

const STATUS_TONE: Record<LostFoundStatus, string> = {
  lost: "border-warn/40 bg-warn/10 text-warn",
  claimed: "border-positive/40 bg-positive/10 text-positive",
  disposed: "border-ink-700 bg-ink-900 text-ink-400",
};

export default async function ObjetosPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ ok?: string; error?: string; status?: string }>;
}) {
  const { tenant: slug } = await params;
  const { ok, error, status } = await searchParams;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const where: { tenantId: string; status?: LostFoundStatus } = { tenantId: tenant.id };
  if (status === "lost" || status === "claimed" || status === "disposed") {
    where.status = status;
  }

  const items = await prisma.lostFoundItem.findMany({
    where,
    include: { postedBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { foundAt: "desc" }],
    take: 100,
  });

  const create = createLostFoundAction.bind(null, slug);
  const updateStatus = updateLostFoundStatusAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Objetos perdidos</h2>
        <p className="text-xs text-ink-400">{items.length} mostrados</p>
      </header>

      {ok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          OK: {ok}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <form
        action={create}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:grid-cols-3"
      >
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-ink-400">Descripción</span>
          <input
            name="description"
            required
            maxLength={500}
            placeholder="Llavero negro con dije de cuero"
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-400">Dónde se encontró</span>
          <input
            name="foundLocation"
            maxLength={200}
            placeholder="Palier 1er piso"
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg sm:col-span-3"
        >
          Cargar objeto
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-500">Filtro:</span>
        {[
          { value: "", label: "Todos" },
          { value: "lost", label: "Sin reclamar" },
          { value: "claimed", label: "Retirados" },
          { value: "disposed", label: "Descartados" },
        ].map((f) => (
          <a
            key={f.value}
            href={f.value ? `/${slug}/admin/objetos?status=${f.value}` : `/${slug}/admin/objetos`}
            className={
              (status ?? "") === f.value
                ? "rounded-full border border-accent bg-accent/10 px-3 py-1 text-accent"
                : "rounded-full border border-ink-700 px-3 py-1 text-ink-300 hover:border-ink-500"
            }
          >
            {f.label}
          </a>
        ))}
      </div>

      {items.length === 0 ? (
        <Empty text="Sin objetos cargados." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[it.status]}`}>
                    {STATUS_LABEL[it.status]}
                  </span>
                  <span className="text-ink-500">
                    {it.foundAt.toLocaleDateString("es-AR")}
                  </span>
                </p>
                <p className="mt-1 font-semibold text-ink-100">{it.description}</p>
                {it.foundLocation && (
                  <p className="text-xs text-ink-400">📍 {it.foundLocation}</p>
                )}
              </div>
              {it.status === "lost" && (
                <div className="flex items-center gap-2">
                  <form action={updateStatus}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <input type="hidden" name="next" value="claimed" />
                    <button
                      type="submit"
                      className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:border-positive/60 hover:text-positive"
                    >
                      Retirado
                    </button>
                  </form>
                  <form action={updateStatus}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <input type="hidden" name="next" value="disposed" />
                    <button
                      type="submit"
                      className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:border-critical/60 hover:text-critical"
                    >
                      Descartar
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

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-10 text-center text-sm text-ink-400">
      {text}
    </div>
  );
}
