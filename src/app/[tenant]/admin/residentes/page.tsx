import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { PAGE_SIZE, Pager, pageFromParam, skipFor } from "@/components/admin/pager";
import { SearchBox } from "@/components/admin/search-box";
import { ResidentActions } from "@/components/admin/resident-actions";
import { SubmitButton } from "@/components/submit-button";
import { normalizeUnitLabel } from "@/lib/unit-label";
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

  // "3B" es inequívocamente una búsqueda por departamento: se compara EXACTO y
  // no se mezcla con nombre/teléfono/email. Sin eso, buscar 3B traía también a
  // los de 13B y 23B (por la etiqueta) y a cualquiera cuyo email contuviera
  // "3b" — justo el ruido que estorba cuando querés llegar a uno puntual.
  // Cualquier otra cosa busca parcial en los cuatro campos.
  const asUnitLabel = normalizeUnitLabel(query);

  const where = {
    tenantId: tenant.id,
    role: "resident" as const,
    ...(!query
      ? {}
      : asUnitLabel
        ? { unitMemberships: { some: { unit: { label: asUnitLabel } } } }
        : {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { phone: { contains: query } },
              { email: { contains: query, mode: "insensitive" as const } },
              {
                unitMemberships: {
                  some: {
                    unit: { label: { contains: query, mode: "insensitive" as const } },
                  },
                },
              },
            ],
          }),
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
        placeholder="Buscar por depto (3B), nombre, teléfono o email"
      />

      {ok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          {/* Un código desconocido no se refleja: viene de la URL. */}
          {OK_MESSAGES[ok] ?? "Operación realizada."}
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
        // Plegado por default: al entrar casi siempre se viene a buscar o
        // editar a alguien, no a dar de alta. Desplegado ocupaba una pantalla
        // entera de celular antes de la lista.
        <details className="rounded-2xl border border-ink-700 bg-ink-850">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-ink-100 [&::-webkit-details-marker]:hidden">
            <span className="mr-2 text-accent" aria-hidden>
              ＋
            </span>
            Agregar residente
          </summary>
          <form
            action={create}
            className="grid grid-cols-1 gap-3 border-t border-ink-800 p-5 sm:grid-cols-2"
          >
          <Field label="Nombre">
            <input
              name="name"
              required
              placeholder="Nombre y apellido"
              maxLength={80}
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input
              name="phone"
              required
              type="tel"
              placeholder="+54 9 11 0000-0000"
              aria-describedby="phone-hint"
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
            <p id="phone-hint" className="mt-1 text-xs text-ink-500">
              Con código de área, sin el 0 ni el 15. Si lo escribís como{" "}
              <span className="font-mono">011 15 0000-0000</span> se corrige solo.
            </p>
          </Field>
          <Field label="Email (opcional)">
            <input
              name="email"
              type="email"
              placeholder="nombre@email.com"
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
              <SubmitButton
                pendingText="Agregando…"
                className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
              >
                Agregar residente
              </SubmitButton>
            </div>
          </form>
        </details>
      )}

      {residents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          {query ? `Ningún residente coincide con “${query}”.` : "Sin residentes cargados."}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {residents.map((r) => (
            // Fila compacta: con cientos de residentes, cada uno tiene que
            // entrar en dos renglones. Editar y borrar viven en un modal.
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-medium text-ink-100">{r.name}</span>
                  {r.unitMemberships.length === 0 ? (
                    <span className="rounded border border-warn/40 bg-warn/10 px-1.5 text-xs text-warn">
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
                <p className="truncate font-mono text-xs text-ink-400">
                  {r.phone ?? "sin tel"}
                  {r.email && <span className="text-ink-500"> · {r.email}</span>}
                </p>
              </div>
              <ResidentActions
                resident={{ id: r.id, name: r.name, phone: r.phone, email: r.email }}
                units={units}
                linkedUnitIds={r.unitMemberships.map((m) => m.unit.id)}
                updateAction={update}
                deleteAction={remove}
              />
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
