import { prisma } from "@/lib/db";
import { getStorageClient } from "@/lib/storage/client";
import { photoRetentionCutoff, photoRetentionDays } from "@/lib/photo-policy";

export interface PhotoPurgeResult {
  scanned: number;
  photosDeleted: number;
  failed: number;
  tenantsSkipped: number;
}

// Cuántos paquetes procesa una corrida. Acota el tiempo del serverless; el
// resto queda para la corrida siguiente (el cron es diario y la ventana de
// retención se mide en días, así que no hay apuro).
const DEFAULT_LIMIT = 500;

/**
 * Borra las fotos de paquetes ya cerrados cuya ventana de retención venció.
 *
 * La foto sirve para resolver disputas de entrega; pasado el plazo es sólo un
 * dato personal guardado sin motivo — la etiqueta del envío suele mostrar
 * nombre y dirección del residente, y el bucket es de lectura pública.
 *
 * Sólo toca paquetes `picked_up` o `cancelled`: mientras el paquete está
 * pendiente la foto se sigue necesitando, sin importar la antigüedad.
 *
 * Primero borra del bucket y después limpia la columna. Si el borrado falla,
 * la fila queda intacta y la próxima corrida reintenta; el orden inverso
 * dejaría el archivo huérfano y sin nada que lo referencie.
 */
export async function purgeExpiredPhotos(
  now: Date = new Date(),
  limit = DEFAULT_LIMIT,
): Promise<PhotoPurgeResult> {
  const storage = getStorageClient();
  if (!storage.isConfigured) {
    return { scanned: 0, photosDeleted: 0, failed: 0, tenantsSkipped: 0 };
  }

  // La retención se configura por edificio, así que no se puede filtrar por
  // fecha en SQL con un único cutoff. Traemos los candidatos por la ventana
  // más larga posible y filtramos por tenant en memoria.
  const tenants = await prisma.tenant.findMany({ select: { id: true, settings: true } });
  const cutoffByTenant = new Map<string, Date | null>();
  let tenantsSkipped = 0;
  for (const tenant of tenants) {
    const cutoff = photoRetentionCutoff(now, photoRetentionDays(tenant.settings));
    if (!cutoff) tenantsSkipped++;
    cutoffByTenant.set(tenant.id, cutoff);
  }

  const activeCutoffs = [...cutoffByTenant.values()].filter((c): c is Date => c !== null);
  if (activeCutoffs.length === 0) {
    return { scanned: 0, photosDeleted: 0, failed: 0, tenantsSkipped };
  }
  const widestCutoff = new Date(Math.max(...activeCutoffs.map((c) => c.getTime())));

  const candidates = await prisma.package.findMany({
    where: {
      status: { in: ["picked_up", "cancelled"] },
      OR: [{ photoUrl: { not: null } }, { pickupPhotoUrl: { not: null } }],
      // `closedAt` no existe como columna; receivedAt siempre es anterior al
      // cierre, así que sirve como filtro grueso y el fino va abajo.
      receivedAt: { lte: widestCutoff },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
    select: {
      id: true,
      tenantId: true,
      photoUrl: true,
      pickupPhotoUrl: true,
      pickedUpAt: true,
      cancelledAt: true,
      receivedAt: true,
    },
  });

  let photosDeleted = 0;
  let failed = 0;

  for (const pkg of candidates) {
    const cutoff = cutoffByTenant.get(pkg.tenantId);
    if (!cutoff) continue;

    // El plazo corre desde que el paquete se cerró, no desde que llegó.
    const closedAt = pkg.pickedUpAt ?? pkg.cancelledAt ?? pkg.receivedAt;
    if (closedAt > cutoff) continue;

    const data: { photoUrl?: null; pickupPhotoUrl?: null } = {};

    for (const field of ["photoUrl", "pickupPhotoUrl"] as const) {
      const url = pkg[field];
      if (!url) continue;
      try {
        await storage.remove(url);
        data[field] = null;
        photosDeleted++;
      } catch (err) {
        failed++;
        console.error(
          `[photo-retention] no se pudo borrar ${field} de ${pkg.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.package.update({ where: { id: pkg.id }, data });
    }
  }

  return { scanned: candidates.length, photosDeleted, failed, tenantsSkipped };
}
