import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function SuperadminHome({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { units: true, packages: true, users: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      {ok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          Edificio <span className="font-mono">{ok}</span> creado. El admin recibirá el magic link al
          intentar iniciar sesión.
        </div>
      )}

      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Edificios</h2>
        <p className="text-xs text-ink-400">{tenants.length} en total</p>
      </header>

      {tenants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          Todavía no creaste ningún edificio.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {tenants.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink-100">{t.name}</p>
                <p className="font-mono text-xs text-ink-400">/{t.slug}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {t._count.units} unidades · {t._count.users} usuarios ·{" "}
                  {t._count.packages} paquetes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/${t.slug}/admin`}
                  className="rounded-xl border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:text-ink-100"
                >
                  Admin →
                </Link>
                <Link
                  href={`/${t.slug}/conserjeria`}
                  className="rounded-xl border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:text-ink-100"
                >
                  Conserjería →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
