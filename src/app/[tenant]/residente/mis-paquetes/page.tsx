import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";

export default async function MisPaquetesPage({
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

  const session = await requireTenantRoleOrRedirect(
    tenant.id,
    ["resident", "guard", "admin"],
    `/${slug}/residente/mis-paquetes`,
  );

  const memberships = await prisma.unitResident.findMany({
    where: { userId: session.userId, unit: { tenantId: tenant.id } },
    select: { unitId: true },
  });
  const unitIds = memberships.map((m) => m.unitId);

  const [pending, history] = await Promise.all([
    prisma.package.findMany({
      where: { tenantId: tenant.id, unitId: { in: unitIds }, status: "awaiting_pickup" },
      orderBy: { receivedAt: "desc" },
      include: { unit: { select: { label: true } } },
    }),
    prisma.package.findMany({
      where: {
        tenantId: tenant.id,
        unitId: { in: unitIds },
        status: { in: ["picked_up", "cancelled"] },
      },
      orderBy: { receivedAt: "desc" },
      take: 20,
      include: { unit: { select: { label: true } } },
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-8">
      <header>
        <p className="text-sm text-ink-400">{tenant.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">Mis paquetes</h1>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Para retirar
        </h2>
        {unitIds.length === 0 ? (
          <EmptyBox
            title="No estás vinculado a ninguna unidad."
            hint="Pedile al administrador del edificio que te asigne a tu departamento."
          />
        ) : pending.length === 0 ? (
          <EmptyBox
            title="No tenés paquetes esperando."
            hint="Cuando llegue uno, te va a llegar un WhatsApp con el código."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-5 rounded-2xl border border-accent/30 bg-ink-850 p-5"
              >
                {/* El mismo PNG que va en el WhatsApp; el token es la capability. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr/${p.pickupToken}`}
                  alt={`QR de retiro ${p.pickupCode}`}
                  className="h-28 w-28 rounded-xl bg-white p-1"
                />
                <div className="min-w-0">
                  <p className="font-mono text-3xl font-bold tracking-widest text-accent">
                    {p.pickupCode}
                  </p>
                  <p className="mt-1 text-sm text-ink-200">
                    Depto {p.unit.label}
                    {p.carrier && ` · ${p.carrier}`}
                  </p>
                  <p className="text-xs text-ink-400">
                    Llegó {p.receivedAt.toLocaleString("es-AR")}
                  </p>
                  <p className="mt-2 text-xs text-ink-500">
                    Mostrá el QR o decí el código en la conserjería.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Historial
        </h2>
        {history.length === 0 ? (
          <EmptyBox title="Todavía no hay historial." />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
            {history.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="text-ink-200">
                    Depto {p.unit.label}
                    {p.carrier && ` · ${p.carrier}`}
                  </p>
                  <p className="text-xs text-ink-400">
                    Llegó {p.receivedAt.toLocaleString("es-AR")}
                  </p>
                </div>
                {p.status === "picked_up" ? (
                  <span className="text-xs text-positive">
                    Retirado {p.pickedUpAt?.toLocaleString("es-AR")}
                  </span>
                ) : (
                  <span className="text-xs text-ink-500">Cancelado</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EmptyBox({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-10 text-center">
      <p className="text-ink-300">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
    </div>
  );
}
