import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createRecurringAuthAction,
  pauseRecurringAuthAction,
  revokeRecurringAuthAction,
  clearUserVacationAction,
  setUserVacationAction,
} from "@/server/admin/authorizations";
import { clearExpiredVacationsForTenant } from "@/server/access/clear-expired-vacations";

const DAY_LABEL = ["D", "L", "M", "M", "J", "V", "S"];

export default async function AutorizacionesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error, ok } = await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  await clearExpiredVacationsForTenant(tenant.id);

  const [auths, units, residentsOnVacation] = await Promise.all([
    prisma.recurringAuthorization.findMany({
      where: { tenantId: tenant.id, status: { not: "revoked" } },
      include: { unit: { select: { label: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.unit.findMany({ where: { tenantId: tenant.id }, orderBy: { label: "asc" } }),
    prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        role: "resident",
        vacationStart: { not: null },
        vacationEnd: { not: null },
      },
      orderBy: { name: "asc" },
      include: { unitMemberships: { include: { unit: { select: { label: true } } } } },
    }),
  ]);

  const create = createRecurringAuthAction.bind(null, slug);
  const pause = pauseRecurringAuthAction.bind(null, slug);
  const revoke = revokeRecurringAuthAction.bind(null, slug);
  const setVac = setUserVacationAction.bind(null, slug);
  const clearVac = clearUserVacationAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Autorizaciones</h2>
        <p className="text-xs text-ink-400">
          {auths.filter((a) => a.status === "active").length} activas · {residentsOnVacation.length} en vacaciones
        </p>
      </header>

      {ok && <Banner tone="positive" text={`OK: ${ok}`} />}
      {error && <Banner tone="critical" text={error} />}

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Crear autorización fija
        </h3>
        <form
          action={create}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:grid-cols-6"
        >
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-ink-400">Unidad</span>
            <select
              name="unitId"
              required
              className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="text-xs text-ink-400">Nombre</span>
            <input
              name="name"
              required
              maxLength={120}
              placeholder="Marcela (mucama)"
              className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </label>
          <fieldset className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <legend className="mb-1 w-full text-xs text-ink-400">Días</legend>
            {[
              { v: "1", l: "L" },
              { v: "2", l: "M" },
              { v: "3", l: "M" },
              { v: "4", l: "J" },
              { v: "5", l: "V" },
              { v: "6", l: "S" },
              { v: "0", l: "D" },
            ].map((d) => (
              <label key={d.v} className="flex cursor-pointer items-center gap-1 text-sm text-ink-200">
                <input
                  type="checkbox"
                  name="daysOfWeek"
                  value={d.v}
                  className="h-4 w-4 rounded border-ink-700 bg-ink-900 text-accent focus:ring-accent"
                />
                {d.l}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 sm:col-span-1">
            <span className="text-xs text-ink-400">Desde</span>
            <input
              name="startTime"
              type="time"
              required
              defaultValue="08:00"
              className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-1">
            <span className="text-xs text-ink-400">Hasta</span>
            <input
              name="endTime"
              type="time"
              required
              defaultValue="12:00"
              className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="self-end rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg transition-transform active:scale-[0.98] sm:col-span-2"
          >
            Crear
          </button>
        </form>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Autorizaciones recurrentes
        </h3>
        {auths.length === 0 ? (
          <Empty text="Todavía no hay autorizaciones fijas." />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
            {auths.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-100">
                    {a.name}
                    {a.status === "paused" && (
                      <span className="ml-2 rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warn">
                        en pausa
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-400">
                    Unidad {a.unit.label} · {a.daysOfWeek.map((d) => DAY_LABEL[d]).join(" ")} · {a.startTime}–{a.endTime}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {a.status === "active" && (
                    <form action={pause}>
                      <input type="hidden" name="authorizationId" value={a.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:border-warn/60 hover:text-warn"
                      >
                        Pausar
                      </button>
                    </form>
                  )}
                  <form action={revoke}>
                    <input type="hidden" name="authorizationId" value={a.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:border-critical/60 hover:text-critical"
                    >
                      Revocar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Residentes en vacaciones
        </h3>
        {residentsOnVacation.length === 0 ? (
          <Empty text="Nadie en vacaciones ahora mismo." />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
            {residentsOnVacation.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-100">{u.name}</p>
                  <p className="text-xs text-ink-400">
                    {u.unitMemberships.map((m) => m.unit.label).join(", ") || "sin unidad"} ·{" "}
                    {u.vacationStart!.toLocaleDateString("es-AR")} → {u.vacationEnd!.toLocaleDateString("es-AR")}
                  </p>
                </div>
                <form action={clearVac}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:border-critical/60 hover:text-critical"
                  >
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Marcar residente en vacaciones
        </h3>
        <ResidentVacationForm slug={slug} tenantId={tenant.id} action={setVac} />
      </section>
    </div>
  );
}

async function ResidentVacationForm({
  tenantId,
  action,
}: {
  slug: string;
  tenantId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const residents = await prisma.user.findMany({
    where: { tenantId, role: "resident", vacationStart: null },
    orderBy: { name: "asc" },
  });
  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:grid-cols-4"
    >
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs text-ink-400">Residente</span>
        <select
          name="userId"
          required
          className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
        >
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-400">Desde</span>
        <input
          name="start"
          type="date"
          required
          className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-400">Hasta</span>
        <input
          name="end"
          type="date"
          required
          className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="self-end rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg sm:col-span-4"
      >
        Marcar
      </button>
    </form>
  );
}

function Banner({ tone, text }: { tone: "positive" | "critical"; text: string }) {
  const cls =
    tone === "positive"
      ? "border-positive/40 bg-positive/10 text-positive"
      : "border-critical/40 bg-critical/10 text-critical";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{text}</div>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-10 text-center text-sm text-ink-400">
      {text}
    </div>
  );
}
