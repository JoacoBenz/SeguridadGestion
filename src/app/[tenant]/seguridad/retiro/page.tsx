import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { PickupFlow } from "@/components/seguridad/pickup-flow";

export default async function RetiroPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  await requireTenantRoleOrRedirect(tenant.id, ["guard", "admin"], `/${slug}/seguridad/retiro`);

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-6">
      <PageHeader slug={slug} tenantName={tenant.name} />
      <PickupFlow tenantSlug={slug} />
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
