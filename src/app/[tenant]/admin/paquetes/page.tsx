import Link from "next/link";
import { notFound } from "next/navigation";
import type { PackageStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cancelPackageAction } from "@/server/admin/packages";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<PackageStatus, string> = {
  awaiting_pickup: "Pendiente",
  picked_up: "Retirado",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<PackageStatus, string> = {
  awaiting_pickup: "border-accent/40 bg-accent/10 text-accent",
  picked_up: "border-positive/40 bg-positive/10 text-positive",
  cancelled: "border-ink-700 bg-ink-800 text-ink-400",
};

function isValidStatus(v: string | undefined): v is PackageStatus {
  return v === "awaiting_pickup" || v === "picked_up" || v === "cancelled";
}

export default async function PaquetesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ status?: string; unit?: string; ok?: string; error?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const status = isValidStatus(sp.status) ? sp.status : undefined;
  const unitId = sp.unit && sp.unit.length > 0 ? sp.unit : undefined;

  const where: Prisma.PackageWhereInput = {
    tenantId: tenant.id,
    ...(status ? { status } : {}),
    ...(unitId ? { unitId } : {}),
  };

  const [units, packages, total] = await Promise.all([
    prisma.unit.findMany({
      where: { tenantId: tenant.id },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    prisma.package.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: PAGE_SIZE,
      include: {
        unit: { select: { label: true } },
        receivedBy: { select: { name: true } },
        pickedUpBy: { select: { name: true } },
      },
    }),
    prisma.package.count({ where }),
  ]);

  const cancel = cancelPackageAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Paquetes</h2>
        <p className="text-xs text-ink-400">
          {packages.length} de {total} mostrados
        </p>
      </header>

      {sp.ok === "cancelado" && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          Paquete cancelado
        </div>
      )}
      {sp.error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {sp.error}
        </div>
      )}

      <FilterBar slug={slug} units={units} status={status} unitId={unitId} />

      {packages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          No hay paquetes con esos filtros.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {packages.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-4">
                <span className="font-mono text-2xl font-bold text-ink-100">
                  {p.unit.label}
                </span>
                <div className="min-w-0 text-sm">
                  <p className="text-ink-200">
                    {p.carrier ?? "sin transportista"}
                    <span className="ml-2 font-mono text-xs text-accent">
                      {p.pickupCode}
                    </span>
                  </p>
                  <p className="text-xs text-ink-400">
                    Recibido {p.receivedAt.toLocaleString("es-AR")} · por {p.receivedBy.name}
                  </p>
                  {p.pickedUpAt && p.pickedUpBy && (
                    <p className="text-xs text-positive">
                      Retirado {p.pickedUpAt.toLocaleString("es-AR")} · por {p.pickedUpBy.name}
                    </p>
                  )}
                  {p.cancelledAt && (
                    <p className="text-xs text-ink-500">
                      Cancelado {p.cancelledAt.toLocaleString("es-AR")}
                      {p.cancelledReason && ` · ${p.cancelledReason}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${STATUS_TONE[p.status]}`}
                >
                  {STATUS_LABEL[p.status]}
                </span>
                {p.status === "awaiting_pickup" && (
                  <CancelButton packageId={p.id} cancelAction={cancel} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterBar({
  slug,
  units,
  status,
  unitId,
}: {
  slug: string;
  units: Array<{ id: string; label: string }>;
  status: PackageStatus | undefined;
  unitId: string | undefined;
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-4"
    >
      <label className="flex flex-1 min-w-[150px] flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
          Estado
        </span>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="awaiting_pickup">Pendientes</option>
          <option value="picked_up">Retirados</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </label>
      <label className="flex flex-1 min-w-[150px] flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
          Depto
        </span>
        <select
          name="unit"
          defaultValue={unitId ?? ""}
          className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
        >
          <option value="">Todos</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg"
        >
          Filtrar
        </button>
        <Link
          href={`/${slug}/admin/paquetes`}
          className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-2 text-sm text-ink-300 hover:text-ink-100"
        >
          Limpiar
        </Link>
      </div>
    </form>
  );
}

function CancelButton({
  packageId,
  cancelAction,
}: {
  packageId: string;
  cancelAction: (fd: FormData) => Promise<void>;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition-colors hover:border-critical/60 hover:text-critical">
        Cancelar
      </summary>
      <form
        action={cancelAction}
        className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-ink-700 bg-ink-850 p-3 shadow-xl"
      >
        <input type="hidden" name="packageId" value={packageId} />
        <label className="text-xs text-ink-400">
          Motivo (queda en el audit log)
          <input
            name="reason"
            required
            maxLength={300}
            placeholder="Devuelto al transportista, mal direccionado…"
            className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-critical px-3 py-1.5 text-xs font-semibold text-ink-950"
        >
          Confirmar cancelación
        </button>
      </form>
    </details>
  );
}
