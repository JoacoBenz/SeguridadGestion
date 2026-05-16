import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { createFaqAction, deleteFaqAction } from "@/server/admin/faq";

export default async function ReglamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { tenant: slug } = await params;
  const { ok, error } = await searchParams;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();
  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin/reglamento`);

  const entries = await prisma.faqEntry.findMany({
    where: { tenantId: tenant.id },
    orderBy: { ordinal: "asc" },
  });

  const create = createFaqAction.bind(null, slug);
  const remove = deleteFaqAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Reglamento (FAQ)</h2>
        <p className="text-xs text-ink-400">{entries.length} preguntas</p>
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
        className="flex flex-col gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Pregunta
          </span>
          <input
            name="question"
            required
            maxLength={280}
            placeholder="¿Cuándo se sacan los residuos reciclables?"
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Respuesta
          </span>
          <textarea
            name="answer"
            required
            maxLength={2000}
            rows={3}
            placeholder="Los martes y viernes a partir de las 21 hs."
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg"
        >
          Agregar
        </button>
      </form>

      {entries.length === 0 ? (
        <Empty text="Todavía no cargaste preguntas." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink-100">
                  {e.ordinal}. {e.question}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-300">{e.answer}</p>
              </div>
              <form action={remove}>
                <input type="hidden" name="faqId" value={e.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:border-critical/60 hover:text-critical"
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

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-10 text-center text-sm text-ink-400">
      {text}
    </div>
  );
}
