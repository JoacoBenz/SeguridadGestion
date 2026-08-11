import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { pickupByCodeAction } from "@/server/packages/pickup-actions";
import { PickupFlow } from "@/components/seguridad/pickup-flow";

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

  await requireTenantRoleOrRedirect(tenant.id, ["guard", "admin"], `/${slug}/seguridad/retiro`);

  const codeAction = pickupByCodeAction.bind(null, slug);

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-6">
      <PageHeader slug={slug} tenantName={tenant.name} />
      <Toasts ok={ok} error={error} />
      <PickupFlow tenantSlug={slug} codeAction={codeAction} />
    </main>
  );
}

function PageHeader({ slug, tenantName }: { slug: string; tenantName: string }) {
  return (
    <header className="mb-8 flex items-center gap-3">
      <Link
        href={`/${slug}/seguridad`}
        aria-label="Volver"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 text-ink-300 transition-colors hover:text-ink-100"
      >
        ←
      </Link>
      <div>
        <p className="text-xs text-ink-400">{tenantName}</p>
        <h1 className="text-xl font-bold">Procesar retiro</h1>
      </div>
    </header>
  );
}

function Toasts({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div className="mb-6 flex flex-col gap-2">
      {ok && (
        <div
          role="status"
          className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-positive"
        >
          <span className="mr-2 font-semibold">Retirado</span>
          <span className="text-ink-100">{ok}</span>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-critical"
        >
          {error}
        </div>
      )}
    </div>
  );
}
