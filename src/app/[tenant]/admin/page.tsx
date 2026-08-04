import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { KpiCard } from "@/components/admin/kpi-card";
import { setGuardPinAction, clearGuardPinAction } from "@/server/conserjeria/device";
import { setPhotoSettingsAction } from "@/server/admin/photo-settings";
import { formatDate, startOfMonthInTimeZone } from "@/lib/datetime";
import { getStorageClient } from "@/lib/storage/client";
import {
  PHOTO_RETENTION_DAYS,
  photoCopyPhone,
  photoMode,
  type PhotoMode,
} from "@/lib/photo-policy";

export default async function AdminDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { tenant: slug } = await params;
  const { ok, error } = await searchParams;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, settings: true, timezone: true },
  });
  if (!tenant) notFound();

  // El layout también chequea, pero layouts y pages renderizan en paralelo:
  // cada page protegida tiene que validar la sesión por su cuenta.
  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin`);

  const hasPin = Boolean((tenant.settings as Record<string, unknown>)?.guardPinHash);
  const setPin = setGuardPinAction.bind(null, slug);
  const clearPin = clearGuardPinAction.bind(null, slug);

  const currentPhotoMode = photoMode(tenant.settings);
  const currentCopyPhone = photoCopyPhone(tenant.settings);
  const storageConfigured = getStorageClient().isConfigured;
  const savePhotoSettings = setPhotoSettingsAction.bind(null, slug);

  const now = new Date();
  const startOfMonth = startOfMonthInTimeZone(now, tenant.timezone);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const [pending, stale, receivedThisMonth, pickedUpThisMonth, unitCount, residentCount] =
    await Promise.all([
      prisma.package.count({
        where: { tenantId: tenant.id, status: "awaiting_pickup" },
      }),
      prisma.package.count({
        where: {
          tenantId: tenant.id,
          status: "awaiting_pickup",
          receivedAt: { lt: threeDaysAgo },
        },
      }),
      prisma.package.count({
        where: { tenantId: tenant.id, receivedAt: { gte: startOfMonth } },
      }),
      prisma.package.count({
        where: {
          tenantId: tenant.id,
          status: "picked_up",
          pickedUpAt: { gte: startOfMonth },
        },
      }),
      prisma.unit.count({ where: { tenantId: tenant.id } }),
      prisma.user.count({
        where: { tenantId: tenant.id, role: "resident" },
      }),
    ]);

  return (
    <div className="flex flex-col gap-8">
      {ok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          {ok}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Esta semana
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Pendientes"
            value={pending}
            tone={pending > 0 ? "accent" : "neutral"}
            hint={pending === 0 ? "todo retirado" : ""}
          />
          <KpiCard
            label=">3 días"
            value={stale}
            tone={stale > 0 ? "warn" : "neutral"}
            hint={stale > 0 ? "necesitan recordatorio" : ""}
          />
          <KpiCard
            label="Recibidos / mes"
            value={receivedThisMonth}
            hint={`desde ${formatDate(startOfMonth, tenant.timezone)}`}
          />
          <KpiCard
            label="Retirados / mes"
            value={pickedUpThisMonth}
            tone="positive"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Edificio
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Unidades" value={unitCount} />
          <KpiCard label="Residentes" value={residentCount} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickAction
            href={`/${slug}/admin/unidades`}
            title="Cargar unidades"
            hint={`${unitCount} cargadas`}
          />
          <QuickAction
            href={`/${slug}/admin/residentes`}
            title="Cargar residentes"
            hint={`${residentCount} cargados`}
          />
          <QuickAction
            href={`/${slug}/admin/paquetes`}
            title="Historial de paquetes"
            hint="ver, filtrar, cancelar"
          />
          <QuickAction
            href={`/${slug}/admin/reportes`}
            title="Reportes"
            hint="actividad mensual"
          />
          <QuickAction
            href={`/${slug}/admin/equipo`}
            title="Equipo"
            hint="admins y guardias"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
          PIN de conserjería
        </h2>
        <div className="rounded-2xl border border-ink-700 bg-ink-850 p-5">
          <p className="mb-4 text-sm text-ink-400">
            Un PIN por edificio para la tablet del mostrador: el guardia lo tipea una vez y el
            dispositivo queda habilitado sin necesidad de mail por turno.{" "}
            {hasPin ? (
              <span className="text-positive">Hay un PIN configurado.</span>
            ) : (
              <span className="text-warn">Todavía no hay PIN — los guardias entran con email.</span>
            )}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <form action={setPin} className="flex items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                  {hasPin ? "Cambiar PIN" : "Nuevo PIN"} (4–8 dígitos)
                </span>
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                  required
                  placeholder="••••"
                  className="w-40 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 focus:border-accent focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg"
              >
                Guardar
              </button>
            </form>
            {hasPin && (
              <form action={clearPin}>
                <button
                  type="submit"
                  className="rounded-xl border border-ink-700 px-4 py-2 text-sm text-ink-400 hover:border-critical/60 hover:text-critical"
                >
                  Borrar PIN
                </button>
              </form>
            )}
          </div>
          {hasPin && (
            <p className="mt-3 text-xs text-ink-500">
              Los dispositivos se desbloquean en{" "}
              <Link href={`/${slug}/conserjeria/desbloquear`} className="text-accent">
                /{slug}/conserjeria/desbloquear
              </Link>
            </p>
          )}
        </div>
      </section>

      <PhotoSettingsSection
        action={savePhotoSettings}
        mode={currentPhotoMode}
        copyPhone={currentCopyPhone}
        storageConfigured={storageConfigured}
      />
    </div>
  );
}

function PhotoSettingsSection({
  action,
  mode,
  copyPhone,
  storageConfigured,
}: {
  action: (formData: FormData) => Promise<void>;
  mode: PhotoMode;
  copyPhone: string | null;
  storageConfigured: boolean;
}) {
  const options: { value: PhotoMode; label: string; hint: string }[] = [
    {
      value: "required",
      label: "Obligatoria",
      hint: "El guardia no puede registrar un paquete sin sacarle foto.",
    },
    {
      value: "optional",
      label: "Opcional",
      hint: "Puede sacarla si quiere, pero no lo frena.",
    },
    {
      value: "disabled",
      label: "Sin fotos",
      hint: "No se pide ni se muestra el campo.",
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
        Fotos de paquetes
      </h2>
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-5">
        {!storageConfigured && (
          <p className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
            El almacenamiento de fotos no está configurado en el servidor, así que por ahora
            no se piden fotos sin importar lo que elijas acá.
          </p>
        )}
        <p className="mb-4 text-sm text-ink-400">
          La foto se le manda al residente por WhatsApp junto con el aviso. Tené en cuenta que
          la etiqueta del envío suele mostrar su nombre y dirección.
        </p>

        <form action={action} className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-400">
              Al registrar un paquete
            </legend>
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 transition-colors hover:border-ink-500"
              >
                <input
                  type="radio"
                  name="photoMode"
                  value={opt.value}
                  defaultChecked={mode === opt.value}
                  className="mt-1 accent-accent"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink-100">{opt.label}</span>
                  <span className="block text-xs text-ink-400">{opt.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
              Copia al WhatsApp de la conserjería (opcional)
            </span>
            <input
              name="conserjeriaPhone"
              type="tel"
              defaultValue={copyPhone ?? ""}
              placeholder="+54 9 11 0000-0000"
              className="w-full max-w-xs rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
            <span className="text-xs text-ink-500">
              Le llega la misma foto al teléfono del mostrador, así queda en su chat para
              buscarla después. Dejalo vacío para no mandar copia.
            </span>
          </label>

          <p className="rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 text-xs text-ink-500">
            Las fotos se borran solas {PHOTO_RETENTION_DAYS} días después de que el paquete se
            retira o se cancela. Las de paquetes pendientes no se borran nunca.
          </p>

          <div>
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function QuickAction({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-ink-700 bg-ink-850 px-5 py-4 transition-colors hover:border-ink-500"
    >
      <div>
        <p className="font-semibold text-ink-100">{title}</p>
        <p className="text-xs text-ink-400">{hint}</p>
      </div>
      <span className="text-ink-500">→</span>
    </Link>
  );
}
