import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AvisosPage({
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

  const broadcasts = await prisma.broadcast.findMany({
    where: { tenantId: tenant.id },
    include: { sentBy: { select: { name: true } } },
    orderBy: { sentAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Avisos</h2>
        <Link
          href={`/${slug}/admin/avisos/nuevo`}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
        >
          + Nuevo aviso
        </Link>
      </header>

      {ok && <Banner tone="positive" text={`Enviado · ${ok}`} />}
      {error && <Banner tone="critical" text={error} />}

      {broadcasts.length === 0 ? (
        <Empty text="Todavía no enviaste avisos." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {broadcasts.map((b) => (
            <li key={b.id} className="flex flex-col gap-1 px-5 py-3">
              <p className="font-semibold text-ink-100">{b.subject}</p>
              <p className="text-sm text-ink-300 whitespace-pre-wrap">{b.body}</p>
              <p className="mt-1 text-xs text-ink-500">
                {b.sentAt.toLocaleString("es-AR")} · {b.sentBy.name} · {b.recipientCount} destinatario
                {b.recipientCount === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
