import { purgeExpiredPhotos, purgeOrphanPhotos } from "@/server/packages/photo-retention";
import { prisma } from "@/lib/db";
import { runCron } from "@/server/cron/run";

// Disparado por Vercel Cron (ver vercel.json) una vez por día. runCron valida
// el Bearer de CRON_SECRET y registra el heartbeat que /superadmin vigila.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runCron("photo-retention", req, async () => {
    const result = await purgeExpiredPhotos();

    // Después de limpiar por retención, barre lo que quedó sin dueño: fotos
    // subidas desde el form que nunca llegaron a asociarse a un paquete.
    const orphans = await purgeOrphanPhotos();

    // Mantenimiento de auth: las sesiones y los magic links vencidos no los
    // borra nadie más. Auth.js sólo purga una sesión vencida cuando ESA cookie
    // vuelve a usarse — las de dispositivos que no volvieron quedan para siempre.
    const now = new Date();
    const [sessions, tokens] = await Promise.all([
      prisma.session.deleteMany({ where: { expires: { lt: now } } }),
      prisma.verificationToken.deleteMany({ where: { expires: { lt: now } } }),
    ]);

    return {
      ...result,
      orphans,
      auth: { expiredSessions: sessions.count, expiredTokens: tokens.count },
    };
  });
}
