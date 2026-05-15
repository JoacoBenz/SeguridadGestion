import { notFound } from "next/navigation";
import type { RecurringAuthStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createRecurringAuthAction,
  pauseRecurringAuthAction,
  resumeRecurringAuthAction,
  revokeRecurringAuthAction,
} from "@/server/access/recurring";
import {
  setVacationAction,
  clearVacationAction,
} from "@/server/access/vacation";

const OK_MESSAGES: Record<string, string> = {
  creada: "Autorización creada",
  pausada: "Autorización pausada",
  reanudada: "Autorización reanudada",
  revocada: "Autorización revocada",
  vacaciones_seteadas: "Vacaciones cargadas",
  vacaciones_borradas: "Vacaciones limpiadas",
};

const STATUS_LABEL: Record<RecurringAuthStatus, string> = {
  active: "Activa",
  paused: "Pausada",
  revoked: "Revocada",
};

const STATUS_TONE: Record<RecurringAuthStatus, string> = {
  active: "border-positive/40 bg-positive/10 text-positive",
  paused: "border-warn/40 bg-warn/10 text-warn",
  revoked: "border-ink-700 bg-ink-800 text-ink-400",
};

const DAYS_SHORT = ["D", "L", "M", "X", "J", "V", "S"];

function dayChips(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => DAYS_SHORT[d] ?? "?").join(" ");
}

export default async function AutorizacionesPage({
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

  const [units, recurring, residents] = await Promise.all([
    prisma.unit.findMany({
      where: { tenantId: tenant.id },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    prisma.recurringAuthorization.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { unit: { select: { id: true, label: true } } },
    }),
    prisma.user.findMany({
      where: { tenantId: tenant.id, role: "resident" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        vacationStart: true,
        vacationEnd: true,
        unitMemberships: {
          include: { unit: { select: { label: true } } },
          take: 1,
        },
      },
    }),
  ]);

  const create = createRecurringAuthAction.bind(null, slug);
  const pause = pauseRecurringAuthAction.bind(null, slug);
  const resume = resumeRecurringAuthAction.bind(null, slug);
  const revoke = revokeRecurringAuthAction.bind(null, slug);
  const setVacation = setVacationAction.bind(null, slug);
  const clearVacation = clearVacationAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Autorizaciones</h2>
        <p className="text-xs text-ink-400">{recurring.length} cargadas</p>
      </header>

      {ok && <SuccessBanner text={OK_MESSAGES[ok] ?? "Listo"} />}
      {error && <ErrorBanner text={error} />}

      {/* Recurrentes — alta */}
      {units.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          Cargá unidades primero antes de crear autorizaciones.
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Nueva autorización fija
          </h3>
          <form
            action={create}
            className="grid grid-cols-1 gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:grid-cols-2"
          >
            <Field label="Nombre">
              <input
                name="name"
                required
                placeholder="Marcela (mucama)"
                maxLength={80}
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
            <Field label="Días (ej: lunes a viernes / martes y jueves)">
              <input
                name="daysOfWeek"
                required
                placeholder="lunes a viernes"
                className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
              />
            </Field>
            <Field label="Horario (ej: 8 a 12 / 08:00-12:00)">
              <input
                name="timeRange"
                required
                placeholder="08:00-12:00"
                className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
              />
            </Field>
            <Field label="Válida hasta (opcional)">
              <input
                name="validUntil"
                type="date"
                className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
              />
            </Field>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
              >
                Crear autorización
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Recurrentes — listado */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
          Cargadas
        </h3>
        {recurring.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
            Sin autorizaciones fijas.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
            {recurring.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-100">
                    {r.name}{" "}
                    <span className="font-mono text-xs text-ink-400">
                      · {r.unit.label}
                    </span>
                  </p>
                  <p className="text-xs text-ink-400">
                    <span className="font-mono">{dayChips(r.daysOfWeek)}</span> ·{" "}
                    <span className="font-mono">
                      {r.startTime}–{r.endTime}
                    </span>
                    {r.validUntil && (
                      <span> · hasta {r.validUntil.toLocaleDateString("es-AR")}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  {r.status === "active" && (
                    <PostButton id={r.id} action={pause} label="Pausar" />
                  )}
                  {r.status === "paused" && (
                    <PostButton id={r.id} action={resume} label="Reanudar" />
                  )}
                  {r.status !== "revoked" && (
                    <PostButton id={r.id} action={revoke} label="Revocar" tone="critical" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Vacaciones */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
          Modo vacaciones
        </h3>
        {residents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
            Sin residentes cargados.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
            {residents.map((r) => {
              const onVacation = r.vacationStart && r.vacationEnd;
              const unitLabel = r.unitMemberships[0]?.unit.label;
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-100">
                      {r.name}{" "}
                      {unitLabel && (
                        <span className="font-mono text-xs text-ink-400">
                          · {unitLabel}
                        </span>
                      )}
                    </p>
                    {onVacation ? (
                      <p className="text-xs text-warn">
                        Vacaciones: {r.vacationStart!.toLocaleDateString("es-AR")} →{" "}
                        {r.vacationEnd!.toLocaleDateString("es-AR")}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-500">Sin vacaciones cargadas</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form
                      action={setVacation}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={r.id} />
                      <input
                        type="date"
                        name="start"
                        required
                        className="rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-ink-100 focus:border-accent focus:outline-none"
                      />
                      <input
                        type="date"
                        name="end"
                        required
                        className="rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs text-ink-100 focus:border-accent focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-100"
                      >
                        Setear
                      </button>
                    </form>
                    {onVacation && (
                      <form action={clearVacation}>
                        <input type="hidden" name="userId" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition-colors hover:border-critical/60 hover:text-critical"
                        >
                          Limpiar
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
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

function SuccessBanner({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
      {text}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
      {text}
    </div>
  );
}

function PostButton({
  id,
  action,
  label,
  tone,
}: {
  id: string;
  action: (fd: FormData) => Promise<void>;
  label: string;
  tone?: "critical";
}) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={
          tone === "critical"
            ? "rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition-colors hover:border-critical/60 hover:text-critical"
            : "rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-100"
        }
      >
        {label}
      </button>
    </form>
  );
}
