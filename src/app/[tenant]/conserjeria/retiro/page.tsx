import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { pickupByCodeAction } from "@/server/packages/pickup-actions";
import { PickupQrScanner } from "@/components/pickup-qr-scanner";

export default async function RetiroPage({
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
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  await requireTenantRoleOrRedirect(tenant.id, ["guard", "admin"], `/${slug}/conserjeria/retiro`);

  const action = pickupByCodeAction.bind(null, slug);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">{tenant.name}</p>
        <h1 className="text-2xl font-bold">Procesar retiro</h1>
      </header>

      {ok && (
        <p className="mb-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
          Retirado: {ok}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900">
          {error}
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Por QR
        </h2>
        <PickupQrScanner tenantSlug={slug} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Por código
        </h2>
        <form action={action} className="flex flex-col gap-3">
          <input
            name="pickupCode"
            required
            inputMode="text"
            autoCapitalize="characters"
            placeholder="ABC234"
            className="rounded border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-widest"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-3 font-semibold text-brand-fg"
          >
            Confirmar retiro
          </button>
        </form>
      </section>
    </main>
  );
}
