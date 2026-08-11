import Link from "next/link";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSuperadminOrRedirect } from "@/lib/auth";
import { trialDaysLeft } from "@/lib/subscription";
import { formatDateTime } from "@/lib/datetime";
import { setTenantSubscriptionAction } from "@/server/superadmin/tenants";
import {
  getNotificationHealth,
  type NotificationHealth,
} from "@/server/superadmin/notification-health";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  suspended: "Suspendida",
};

const STATUS_TONE: Record<SubscriptionStatus, string> = {
  trial: "border-accent/40 bg-accent/10 text-accent",
  active: "border-positive/40 bg-positive/10 text-positive",
  past_due: "border-warn/40 bg-warn/10 text-warn",
  suspended: "border-critical/40 bg-critical/10 text-critical",
};

export default async function SuperadminHome({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; subok?: string; error?: string }>;
}) {
  // El layout también chequea, pero layouts y pages renderizan en paralelo:
  // cada page protegida tiene que validar la sesión por su cuenta.
  await requireSuperadminOrRedirect("/superadmin");

  const { ok, subok, error } = await searchParams;

  const [tenants, health] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { units: true, packages: true, users: true } },
      },
    }),
    getNotificationHealth(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {ok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          Edificio <span className="font-mono">{ok}</span> creado. El admin recibirá el magic link al
          intentar iniciar sesión.
        </div>
      )}
      {subok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          Suscripción de <span className="font-mono">{subok}</span> actualizada.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <WhatsAppHealth health={health} />

      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Edificios</h2>
        <p className="text-xs text-ink-400">{tenants.length} en total</p>
      </header>

      {tenants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          Todavía no creaste ningún edificio.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {tenants.map((t) => {
            const daysLeft = trialDaysLeft(t);
            return (
              <li key={t.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-ink-100">{t.name}</p>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[t.subscriptionStatus]}`}
                    >
                      {STATUS_LABEL[t.subscriptionStatus]}
                      {daysLeft !== null && ` · ${daysLeft} día${daysLeft === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-ink-400">/{t.slug}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {t._count.units} unidades · {t._count.users} usuarios ·{" "}
                    {t._count.packages} paquetes
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SubscriptionButton tenantId={t.id} subAction="activate" label="Activar" />
                  <SubscriptionButton tenantId={t.id} subAction="extend_trial" label="+14 días" />
                  <SubscriptionButton tenantId={t.id} subAction="suspend" label="Suspender" danger />
                  <span className="mx-1 hidden h-6 w-px bg-ink-700 lg:block" />
                  <Link
                    href={`/${t.slug}/admin`}
                    className="rounded-xl border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:text-ink-100"
                  >
                    Admin →
                  </Link>
                  <Link
                    href={`/${t.slug}/seguridad`}
                    className="rounded-xl border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:text-ink-100"
                  >
                    Seguridad →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// El semáforo de envíos: verde de un renglón cuando no hay fallos, panel rojo
// con el detalle por edificio cuando los hay. El caso que tiene que saltar a
// la vista es "el token de Meta murió anoche y nadie se enteró".
function WhatsAppHealth({ health }: { health: NotificationHealth }) {
  if (health.failedCount === 0) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm text-ink-400">
        <span className="mr-2 text-positive" aria-hidden>
          ●
        </span>
        WhatsApp: {health.okCount === 0 ? "sin actividad" : `${health.okCount} enviados, sin fallos`}{" "}
        en las últimas {health.windowHours} h.
      </div>
    );
  }

  const attempts = health.okCount + health.failedCount;
  return (
    <section
      role="alert"
      className="rounded-2xl border border-critical/40 bg-critical/10 p-5"
    >
      <h2 className="font-bold text-critical">
        WhatsApp: {health.failedCount}
        {health.truncated ? "+" : ""} de {attempts}
        {health.truncated ? "+" : ""} envíos fallaron en las últimas {health.windowHours} h
      </h2>
      <p className="mt-1 text-sm text-ink-300">
        Los paquetes se registran igual, pero estos avisos no llegaron. Si el error se repite
        en todos los edificios, lo más probable es el token de Meta o el número.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {health.tenants.map((t) => (
          <li key={t.slug} className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-semibold text-ink-100">
                {t.name} <span className="font-mono text-xs text-ink-500">/{t.slug}</span>
              </p>
              <p className="text-sm text-critical">
                {t.count} fallo{t.count === 1 ? "" : "s"}
                <span className="text-ink-500"> · último {formatDateTime(t.lastAt)}</span>
              </p>
            </div>
            <p className="mt-1 font-mono text-xs text-ink-400">
              {t.templates.join(", ")}
            </p>
            {t.lastError && (
              <p className="mt-1 truncate font-mono text-xs text-warn" title={t.lastError}>
                {t.lastError}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SubscriptionButton({
  tenantId,
  subAction,
  label,
  danger,
}: {
  tenantId: string;
  subAction: "activate" | "suspend" | "extend_trial";
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={setTenantSubscriptionAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="subAction" value={subAction} />
      <button
        type="submit"
        className={
          danger
            ? "rounded-xl border border-ink-700 px-3 py-2 text-sm text-ink-400 transition-colors hover:border-critical/60 hover:text-critical"
            : "rounded-xl border border-ink-700 px-3 py-2 text-sm text-ink-300 transition-colors hover:border-positive/60 hover:text-positive"
        }
      >
        {label}
      </button>
    </form>
  );
}
