import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";

export default async function ConserjeriaHome({
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

  await requireTenantRoleOrRedirect(tenant.id, ["guard", "admin"], `/${slug}/conserjeria`);

  const pendientes = await prisma.package.findMany({
    where: { tenantId: tenant.id, status: "awaiting_pickup" },
    orderBy: { receivedAt: "desc" },
    include: { unit: { select: { label: true } } },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">{tenant.name}</p>
        <h1 className="text-2xl font-bold">Conserjería</h1>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          href={`/${slug}/conserjeria/ingreso`}
          className="rounded-xl bg-brand px-4 py-6 text-center text-lg font-semibold text-brand-fg"
        >
          Registrar paquete
        </Link>
        <Link
          href={`/${slug}/conserjeria/retiro`}
          className="rounded-xl border-2 border-brand px-4 py-6 text-center text-lg font-semibold text-brand"
        >
          Procesar retiro
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Pendientes de retiro ({pendientes.length})</h2>
        {pendientes.length === 0 ? (
          <p className="text-slate-500">No hay paquetes esperando retiro.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {pendientes.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">Depto {p.unit.label}</p>
                  <p className="text-sm text-slate-500">
                    {p.carrier ?? "Sin transportista"} · {p.receivedAt.toLocaleString("es-AR")}
                  </p>
                </div>
                <code className="rounded bg-slate-100 px-2 py-1 font-mono text-sm">
                  {p.pickupCode}
                </code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
