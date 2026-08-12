import { prisma } from "@/lib/db";

// Salud de los crons para el superadmin.
//
// Un cron que deja de dispararse no falla: simplemente no pasa. runCron deja
// un heartbeat (AuditLog global, entityType "Cron") en cada corrida; acá se
// lee el último por job y se decide si está sano, vencido o roto. Mismo
// patrón que notification-health: summarizeCronRuns es puro y testeable,
// getCronHealth hace la query y delega.

/** Los crons que DEBEN estar corriendo (vercel.json). Hardcodeados a propósito:
 *  si mañana se agrega un cron y no se lista acá, el panel no puede extrañarlo. */
export const KNOWN_CRON_JOBS = ["reminders", "photo-retention"] as const;

/** Ambos crons son diarios: más de 36 h sin corrida = se salteó al menos una. */
export const CRON_STALE_HOURS = 36;

export interface CronRunRow {
  entityId: string;
  action: string; // "cron.ok" | "cron.failed"
  at: Date;
}

export type CronJobStatus = "ok" | "stale" | "failed" | "never";

export interface CronJobHealth {
  name: string;
  status: CronJobStatus;
  lastRunAt: Date | null;
}

export interface CronHealth {
  staleHours: number;
  jobs: CronJobHealth[];
  /** true si algún job requiere atención (stale o failed). */
  attention: boolean;
}

export function summarizeCronRuns(rows: CronRunRow[], now: Date): CronHealth {
  const staleCutoff = new Date(now.getTime() - CRON_STALE_HOURS * 60 * 60 * 1000);

  const jobs: CronJobHealth[] = KNOWN_CRON_JOBS.map((name) => {
    // rows viene ordenado desc por fecha; el primero del job es su última corrida.
    const last = rows.find((r) => r.entityId === name);
    if (!last) return { name, status: "never", lastRunAt: null };
    if (last.at < staleCutoff) return { name, status: "stale", lastRunAt: last.at };
    if (last.action === "cron.failed") return { name, status: "failed", lastRunAt: last.at };
    return { name, status: "ok", lastRunAt: last.at };
  });

  return {
    staleHours: CRON_STALE_HOURS,
    jobs,
    attention: jobs.some((j) => j.status === "stale" || j.status === "failed"),
  };
}

export async function getCronHealth(now: Date = new Date()): Promise<CronHealth> {
  // Alcanza con las últimas corridas: 20 filas cubren de sobra los 2 jobs.
  const rows = await prisma.auditLog.findMany({
    where: { entityType: "Cron" },
    orderBy: { at: "desc" },
    take: 20,
    select: { entityId: true, action: true, at: true },
  });
  return summarizeCronRuns(rows, now);
}
