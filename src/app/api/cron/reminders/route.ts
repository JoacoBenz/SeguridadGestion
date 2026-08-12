import { sendPendingReminders } from "@/server/packages/reminders";
import { runCron } from "@/server/cron/run";

// Disparado por Vercel Cron (ver vercel.json) una vez por día. runCron valida
// `Authorization: Bearer ${CRON_SECRET}` (en dev sin secret se permite) y
// registra el heartbeat que /superadmin vigila.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runCron("reminders", req, async () => {
    const result = await sendPendingReminders();
    return { ...result };
  });
}
