import { prisma } from "@/lib/db";
import { getStorageClient } from "@/lib/storage/client";
import { photoRetentionCutoff } from "@/lib/photo-policy";

export interface PhotoPurgeResult {
  scanned: number;
  photosDeleted: number;
  failed: number;
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
    return { scanned: 0, photosDeleted: 0, failed: 0 };
  }

  const cutoff = photoRetentionCutoff(now);

  const candidates = await prisma.package.findMany({
    where: {
      status: { in: ["picked_up", "cancelled"] },
      OR: [{ photoUrl: { not: null } }, { pickupPhotoUrl: { not: null } }],
      // `receivedAt` es siempre anterior al cierre, así que sirve de filtro
      // grueso en SQL; el corte fino por fecha de cierre va en el bucle.
      receivedAt: { lte: cutoff },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
    select: {
      id: true,
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

  return { scanned: candidates.length, photosDeleted, failed };
}

export interface OrphanPurgeResult {
  listed: number;
  orphansDeleted: number;
  failed: number;
}

// Margen antes de considerar huérfano a un archivo recién subido: la foto se
// sube apenas el guardia la saca, pero el paquete recién se crea cuando manda
// el form. Sin esta ventana borraríamos la foto de un formulario todavía
// abierto sobre el mostrador.
const ORPHAN_MIN_AGE_HOURS = 24;

/**
 * Borra archivos del bucket que ninguna fila referencia.
 *
 * `PhotoCapture` sube la foto al elegirla, antes de enviar el formulario. Si el
 * guardia saca otra foto, abandona el alta o el registro falla, el archivo
 * anterior queda en el bucket sin ningún `Package` que lo apunte — y como
 * `purgeExpiredPhotos` recorre filas, nunca lo ve. Sacar una foto dos veces
 * alcanza para dejar un huérfano permanente.
 */
export async function purgeOrphanPhotos(
  now: Date = new Date(),
  minAgeHours = ORPHAN_MIN_AGE_HOURS,
): Promise<OrphanPurgeResult> {
  const storage = getStorageClient();
  if (!storage.isConfigured) return { listed: 0, orphansDeleted: 0, failed: 0 };

  const objects = await storage.list("packages/");
  const cutoff = new Date(now.getTime() - minAgeHours * 60 * 60 * 1000);

  // Un objeto sin fecha no se toca: preferimos dejar basura antes que borrar
  // algo que quizás se subió recién.
  const oldEnough = objects.filter((o) => o.lastModified && o.lastModified <= cutoff);
  if (oldEnough.length === 0) {
    return { listed: objects.length, orphansDeleted: 0, failed: 0 };
  }

  // Todas las URLs referenciadas, en memoria. A esta escala (miles de filas)
  // entra sin problema; si algún día no entra, hay que ir por lotes de keys.
  const referenced = new Set<string>();
  const rows = await prisma.package.findMany({
    where: { OR: [{ photoUrl: { not: null } }, { pickupPhotoUrl: { not: null } }] },
    select: { photoUrl: true, pickupPhotoUrl: true },
  });
  for (const row of rows) {
    if (row.photoUrl) referenced.add(row.photoUrl);
    if (row.pickupPhotoUrl) referenced.add(row.pickupPhotoUrl);
  }

  let orphansDeleted = 0;
  let failed = 0;
  for (const obj of oldEnough) {
    if (referenced.has(obj.url)) continue;
    try {
      await storage.remove(obj.url);
      orphansDeleted++;
    } catch (err) {
      failed++;
      console.error(
        `[photo-retention] no se pudo borrar el huérfano ${obj.key}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return { listed: objects.length, orphansDeleted, failed };
}
