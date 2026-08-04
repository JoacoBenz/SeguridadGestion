import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { PAGE_SIZE, Pager, pageFromParam, skipFor } from "@/components/admin/pager";
import { SearchBox } from "@/components/admin/search-box";
import {
  createResidentAction,
  deleteResidentAction,
  removeFromUnitAction,
  updateResidentAction,
} from "@/server/admin/residents";

const OK_MESSAGES: Record<string, string> = {
  creado: "Residente creado",
  actualizado: "Residente actualizado",
  borrado: "Residente borrado",
  desvinculado: "Residente desvinculado del depto",
};

export default async function ResidentesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string; ok?: string; q?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error, ok, q, page: pageParam } = await searchParams;
  const page = pageFromParam(pageParam);
  const query = q?.trim() ?? "";

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  // Las pages no pueden delegar el auth al layout (renderizan en paralelo).
  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin/residentes`);

  // El filtro busca por nombre, teléfono, email o etiqueta de depto: son las
  // cuatro cosas por las que un admin llega a un residente.
  const where = {
    tenantId: tenant.id,
    role: "resident" as const,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query } },
            { email: { contains: query, mode: "insensitive" as const } },
            {
              unitMemberships: {
                some: { unit: { label: { contains: query, mode: "insensitive" as const } } },
              },
            },
          ],
        }
      : {}),
  };

  const [units, residents, total] = await Promise.all([
    prisma.unit.findMany({
      where: { tenantId: tenant.id },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: skipFor(page),
      take: PAGE_SIZE,
      include: {
        unitMemberships: {
          include: { unit: { select: { id: true, label: true } } },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const create = createResidentAction.bind(null, slug);
  const update = updateResidentAction.bind(null, slug);
  const removeFromUnit = removeFromUnitAction.bind(null, slug);
  const remove = deleteResidentAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Residentes</h2>
        <p className="text-xs text-ink-400">{total} cargados</p>
      </header>

      <SearchBox
        basePath={`/${slug}/admin/residentes`}
        defaultValue={query}
        placeholder="Buscar por nombre, teléfono, email o depto"
      />

      {ok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          {OK_MESSAGES[ok] ?? ok}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      {units.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          Cargá unidades primero antes de agregar residentes.
        </div>
      ) : (
        <form
          action={create}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:grid-cols-2"
        >
          <Field label="Nombre">
            <input
              name="name"
              required
              placeholder="Juan Pérez"
              maxLength={80}
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input
              name="phone"
              required
              type="tel"
              placeholder="+54 9 11 2388-5910"
              aria-describedby="phone-hint"
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
            <p id="phone-hint" className="mt-1 text-xs text-ink-500">
              Con código de área, sin el 0 ni el 15. Si lo escribís como{" "}
              <span className="font-mono">011 15 2388-5910</span> se corrige solo.
            </p>
          </Field>
          <Field label="Email (opcional)">
            <input
              name="email"
              type="email"
              placeholder="juan@email.com"
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </Field>
          <Field label="Departamento">
            <select
              name="unitId"
              required
              defaultValue=""
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Elegí un depto
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
            >
              Agregar residente
            </button>
          </div>
        </form>
      )}

      {residents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          {query ? `Ningún residente coincide con “${query}”.` : "Sin residentes cargados."}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {residents.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-100">{r.name}</p>
                <p className="font-mono text-xs text-ink-400">
                  {r.phone ?? "sin tel"}
                  {r.email && <span className="text-ink-500"> · {r.email}</span>}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.unitMemberships.length === 0 ? (
                    <span className="rounded-md border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs text-warn">
                      sin depto
                    </span>
                  ) : (
                    r.unitMemberships.map((m) => (
                      <UnitChip
                        key={m.unit.id}
                        label={m.unit.label}
                        action={removeFromUnit}
                        userId={r.id}
                        unitId={m.unit.id}
                      />
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <EditButton
                  resident={{ id: r.id, name: r.name, phone: r.phone, email: r.email }}
                  linkedUnitIds={r.unitMemberships.map((m) => m.unit.id)}
                  units={units}
                  updateAction={update}
                />
                <form action={remove}>
                  <input type="hidden" name="userId" value={r.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-ink-700 px-3 py-2.5 text-xs text-ink-400 transition-colors hover:border-critical/60 hover:text-critical sm:w-auto sm:py-1.5"
                  >
                    Borrar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pager
        page={page}
        total={total}
        basePath={`/${slug}/admin/residentes`}
        params={{ q: query || undefined }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function EditButton({
  resident,
  linkedUnitIds,
  units,
  updateAction,
}: {
  resident: { id: string; name: string; phone: string | null; email: string | null };
  linkedUnitIds: string[];
  units: Array<{ id: string; label: string }>;
  updateAction: (fd: FormData) => Promise<void>;
}) {
  const linkable = units.filter((u) => !linkedUnitIds.includes(u.id));
  return (
    <details className="w-full sm:relative sm:w-auto">
      <summary className="cursor-pointer list-none rounded-lg border border-ink-700 px-3 py-2.5 text-center text-xs text-ink-400 transition-colors hover:border-accent/60 hover:text-accent sm:py-1.5 sm:text-left">
        Editar
      </summary>
      <form
        action={updateAction}
        className="mt-2 flex w-full flex-col gap-2 rounded-xl border border-ink-700 bg-ink-850 p-3 shadow-xl sm:absolute sm:right-0 sm:z-10 sm:w-72"
      >
        <input type="hidden" name="userId" value={resident.id} />
        <label className="text-xs text-ink-400">
          Nombre
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={resident.name}
            className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="text-xs text-ink-400">
          Teléfono (WhatsApp)
          <input
            name="phone"
            required
            type="tel"
            defaultValue={resident.phone ?? ""}
            className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 font-mono text-sm text-ink-100 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="text-xs text-ink-400">
          Email (vacío lo borra)
          <input
            name="email"
            type="email"
            defaultValue={resident.email ?? ""}
            className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-accent focus:outline-none"
          />
        </label>
        {linkable.length > 0 && (
          <label className="text-xs text-ink-400">
            Vincular a depto (opcional)
            <select
              name="unitId"
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-accent focus:outline-none"
            >
              <option value="">No cambiar</option>
              {linkable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg"
        >
          Guardar cambios
        </button>
      </form>
    </details>
  );
}

function UnitChip({
  label,
  userId,
  unitId,
  action,
}: {
  label: string;
  userId: string;
  unitId: string;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="unitId" value={unitId} />
      <button
        type="submit"
        title="Desvincular de este depto"
        className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent transition-colors hover:border-critical/40 hover:bg-critical/10 hover:text-critical"
      >
        {label} <span aria-hidden>×</span>
      </button>
    </form>
  );
}
