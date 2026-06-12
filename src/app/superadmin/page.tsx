import Link from "next/link";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSuperadminOrRedirect } from "@/lib/auth";
import { trialDaysLeft } from "@/lib/subscription";
import { setTenantSubscriptionAction } from "@/server/superadmin/tenants";

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

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { units: true, packages: true, users: true } },
    },
  });

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
                    href={`/${t.slug}/conserjeria`}
                    className="rounded-xl border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:text-ink-100"
                  >
                    Conserjería →
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
