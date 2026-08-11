import { prisma } from "@/lib/db";

// Salud de los envíos de WhatsApp para el superadmin.
//
// Un envío que falla queda persistido en Notification, pero nadie mira esa
// tabla: si el token de Meta se invalida un martes a la noche, los paquetes se
// siguen registrando y los avisos fallan en silencio, fila tras fila. Esta
// vista agrega los fallos de la ventana reciente por edificio para que el
// problema sea visible de un vistazo al entrar a /superadmin.
//
// summarizeFailures es puro y unit-testeable; getNotificationHealth hace las
// queries y delega ahí.

export const HEALTH_WINDOW_HOURS = 48;

/** Cuántos fallos crudos se leen como máximo. Si un token roto generó miles,
 *  con los primeros 500 alcanza para el diagnóstico — el resumen dice "500+". */
const MAX_FAILED_ROWS = 500;

export interface FailedNotificationRow {
  tenantSlug: string;
  tenantName: string;
  templateName: string;
  errorMessage: string | null;
  createdAt: Date;
}

export interface TenantFailures {
  slug: string;
  name: string;
  count: number;
  /** Plantillas afectadas, sin repetir. */
  templates: string[];
  /** El error más reciente: casi siempre es el mismo para todos (token, número). */
  lastError: string | null;
  lastAt: Date;
}

export interface NotificationHealth {
  windowHours: number;
  okCount: number;
  failedCount: number;
  /** true cuando el conteo de fallos tocó el tope de lectura (hay más). */
  truncated: boolean;
  tenants: TenantFailures[];
}

export function summarizeFailures(rows: FailedNotificationRow[]): TenantFailures[] {
  const byTenant = new Map<string, TenantFailures>();
  for (const row of rows) {
    const entry = byTenant.get(row.tenantSlug) ?? {
      slug: row.tenantSlug,
      name: row.tenantName,
      count: 0,
      templates: [],
      lastError: null,
      lastAt: row.createdAt,
    };
    entry.count += 1;
    if (!entry.templates.includes(row.templateName)) entry.templates.push(row.templateName);
    if (row.createdAt >= entry.lastAt) {
      entry.lastAt = row.createdAt;
      entry.lastError = row.errorMessage ?? entry.lastError;
    }
    byTenant.set(row.tenantSlug, entry);
  }
  return [...byTenant.values()].sort((a, b) => b.count - a.count);
}

export async function getNotificationHealth(now: Date = new Date()): Promise<NotificationHealth> {
  const since = new Date(now.getTime() - HEALTH_WINDOW_HOURS * 60 * 60 * 1000);

  const [okCount, failed] = await Promise.all([
    prisma.notification.count({
      where: { createdAt: { gte: since }, status: { in: ["sent", "delivered", "read"] } },
    }),
    prisma.notification.findMany({
      where: { createdAt: { gte: since }, status: "failed" },
      orderBy: { createdAt: "desc" },
      take: MAX_FAILED_ROWS,
      select: {
        templateName: true,
        errorPayload: true,
        createdAt: true,
        package: { select: { tenant: { select: { slug: true, name: true } } } },
      },
    }),
  ]);

  const rows: FailedNotificationRow[] = failed.map((n) => ({
    tenantSlug: n.package.tenant.slug,
    tenantName: n.package.tenant.name,
    templateName: n.templateName,
    errorMessage:
      typeof (n.errorPayload as { message?: unknown } | null)?.message === "string"
        ? ((n.errorPayload as { message: string }).message)
        : null,
    createdAt: n.createdAt,
  }));

  return {
    windowHours: HEALTH_WINDOW_HOURS,
    okCount,
    failedCount: rows.length,
    truncated: rows.length === MAX_FAILED_ROWS,
    tenants: summarizeFailures(rows),
  };
}
