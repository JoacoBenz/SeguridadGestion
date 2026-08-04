import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { PAGE_SIZE, Pager, pageFromParam, skipFor } from "@/components/admin/pager";


// Etiquetas legibles para las acciones conocidas; las desconocidas se muestran crudas.
const ACTION_LABEL: Record<string, string> = {
  "package.registered": "Paquete registrado",
  "package.picked_up": "Paquete retirado",
  "package.cancelled": "Paquete cancelado",
  "package.reminder_sent": "Recordatorio enviado",
  "package.reminder_escalated": "Escalado al admin",
  "unit.created": "Unidad creada",
  "unit.deleted": "Unidad borrada",
  "resident.created": "Residente creado",
  "resident.updated": "Residente actualizado",
  "resident.deleted": "Residente borrado",
  "resident.removed_from_unit": "Residente desvinculado",
  "residents.imported": "Residentes importados",
  "device.pin_set": "PIN de conserjería fijado",
  "device.pin_cleared": "PIN de conserjería borrado",
  "team.member_added": "Miembro del equipo agregado",
  "team.role_changed": "Rol de miembro cambiado",
  "team.member_removed": "Miembro del equipo eliminado",
  "team.member_unlinked": "Miembro del equipo desvinculado",
  "tenant.created": "Edificio creado",
};

export default async function AuditoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, timezone: true },
  });
  if (!tenant) notFound();

  // Las pages no pueden delegar el auth al layout (renderizan en paralelo).
  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin/auditoria`);

  const page = pageFromParam(sp.page);
  const logWhere = {
    tenantId: tenant.id,
    ...(sp.action ? { action: sp.action } : {}),
  };

  const [logs, actions, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: logWhere,
      orderBy: { at: "desc" },
      skip: skipFor(page),
      take: PAGE_SIZE,
      include: { actor: { select: { name: true } } },
    }),
    prisma.auditLog.findMany({
      where: { tenantId: tenant.id },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.count({ where: logWhere }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Auditoría</h2>
        <p className="text-xs text-ink-400">{total} eventos</p>
      </header>

      <form method="get" className="flex items-end gap-2 rounded-2xl border border-ink-700 bg-ink-850 p-4">
        <label className="flex flex-1 min-w-[180px] flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Acción
          </span>
          <select
            name="action"
            defaultValue={sp.action ?? ""}
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
          >
            <option value="">Todas</option>
            {actions.map((a) => (
              <option key={a.action} value={a.action}>
                {ACTION_LABEL[a.action] ?? a.action}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg"
        >
          Filtrar
        </button>
      </form>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-12 text-center text-sm text-ink-400">
          Sin eventos registrados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
          {logs.map((log) => {
            const meta = log.metadata as Record<string, unknown>;
            const metaEntries = Object.entries(meta).filter(([, v]) => v !== null);
            return (
              <li key={log.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-ink-100">
                    {ACTION_LABEL[log.action] ?? log.action}
                    <span className="ml-2 text-xs text-ink-500">
                      {log.entityType} {log.entityId.slice(-6)}
                    </span>
                  </p>
                  <p className="shrink-0 text-xs text-ink-400">
                    {formatDateTime(log.at, tenant.timezone)}
                  </p>
                </div>
                <p className="text-xs text-ink-400">
                  {log.actor?.name ?? "Sistema"}
                  {metaEntries.length > 0 && (
                    <span className="ml-2 font-mono text-ink-500">
                      {metaEntries.map(([k, v]) => `${k}=${String(v)}`).join(" · ")}
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Pager
        page={page}
        total={total}
        basePath={`/${slug}/admin/auditoria`}
        params={{ action: sp.action }}
      />
    </div>
  );
}
