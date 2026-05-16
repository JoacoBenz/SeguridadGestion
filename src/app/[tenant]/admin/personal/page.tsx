import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { createGuardAction, deleteGuardAction } from "@/server/admin/guards";

const OK_MESSAGES: Record<string, string> = {
  creado: "Guardia creado — recibirá el magic link al iniciar sesión",
  borrado: "Guardia borrado",
};

export default async function PersonalPage({
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
    select: { id: true },
  });
  if (!tenant) notFound();
  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin/personal`);

  const guards = await prisma.user.findMany({
    where: { tenantId: tenant.id, role: "guard" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });

  const create = createGuardAction.bind(null, slug);
  const remove = deleteGuardAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Personal de conserjería</h2>
        <p className="text-xs text-ink-400">{guards.length} cargados</p>
      </header>

      <p className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-xs text-ink-400">
        Los guardias inician sesión con el email cargado acá. Vas a recibir un
        <span className="text-ink-200"> magic link</span> en ese email cada vez que ingresen.
      </p>

      {ok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          {OK_MESSAGES[ok] ?? "Listo"}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <form
        action={create}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:grid-cols-2"
      >
        <Field label="Nombre">
          <input
            name="name"
            required
            placeholder="María González"
            maxLength={80}
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </Field>
        <Field label="Email (para login)">
          <input
            name="email"
            required
            type="email"
            placeholder="maria@email.com"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </Field>
        <Field label="Teléfono (opcional)">
          <input
            name="phone"
            type="tel"
            placeholder="+5491100000000"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </Field>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
          >
            Agregar guardia
          </button>
        </div>
      </form>

      {guards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          Sin guardias cargados. Agregá al menos uno para que pueda recibir paquetes.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {guards.map((g) => (
            <li
              key={g.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-100">{g.name}</p>
                <p className="font-mono text-xs text-ink-400">
                  {g.email ?? "sin email"}
                  {g.phone && <span className="text-ink-500"> · {g.phone}</span>}
                </p>
                <p className="mt-1 text-[11px] text-ink-500">
                  Alta: {g.createdAt.toLocaleDateString("es-AR")}
                </p>
              </div>
              <form action={remove}>
                <input type="hidden" name="userId" value={g.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition-colors hover:border-critical/60 hover:text-critical"
                >
                  Borrar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
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
