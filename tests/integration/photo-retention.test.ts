import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { purgeExpiredPhotos, purgeOrphanPhotos } from "@/server/packages/photo-retention";
import { setStorageClient, type StorageClient, type StoredObject } from "@/lib/storage/client";

// El cron que borra fotos, contra Postgres real. Acá se fijan los dos
// invariantes que más duelen si se rompen: que las fotos de paquetes
// PENDIENTES no se toquen nunca, y que un fallo del bucket no deje la fila
// apuntando a un archivo que ya no existe (ni al revés).

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date();
const BASE = "https://bucket.test/paquetes";

let removed: string[] = [];
let removeShouldFail = false;
let listing: StoredObject[] = [];

const fakeStorage: StorageClient = {
  isConfigured: true,
  async put() {
    return { url: `${BASE}/packages/x/nuevo.jpg` };
  },
  async remove(url) {
    if (removeShouldFail) throw new Error("bucket caído (simulado)");
    removed.push(url);
  },
  isOwnUrl: (url) => url.startsWith(`${BASE}/`),
  keyOf: (url) => (url.startsWith(`${BASE}/`) ? url.slice(BASE.length + 1) : null),
  async list() {
    return listing;
  },
  async signedUrl(url) {
    return url;
  },
};

let tenantId: string;
let unitId: string;
let guardId: string;

interface Spec {
  status?: "awaiting_pickup" | "picked_up" | "cancelled";
  closedDaysAgo?: number;
  photoUrl?: string | null;
}

async function pkg({ status = "picked_up", closedDaysAgo = 40, photoUrl }: Spec) {
  const closed = new Date(NOW.getTime() - closedDaysAgo * DAY);
  return prisma.package.create({
    data: {
      tenantId,
      unitId,
      receivedByUserId: guardId,
      pickupCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      // receivedAt anterior al cierre, como en la realidad.
      receivedAt: new Date(closed.getTime() - DAY),
      status,
      pickedUpAt: status === "picked_up" ? closed : null,
      cancelledAt: status === "cancelled" ? closed : null,
      photoUrl: photoUrl ?? null,
    },
  });
}

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  tenantId = (
    await prisma.tenant.create({ data: { slug: `it-ret-${suffix}`, name: "Ret Test" } })
  ).id;
  unitId = (await prisma.unit.create({ data: { tenantId, label: "1A" } })).id;
  guardId = (
    await prisma.user.create({
      data: { tenantId, email: `g-ret-${suffix}@test.local`, name: "G", role: "guard" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.package.deleteMany({ where: { tenantId } });
  await prisma.unit.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
});

beforeEach(() => {
  removed = [];
  removeShouldFail = false;
  listing = [];
  setStorageClient(fakeStorage);
});

afterEach(async () => {
  setStorageClient(null);
  await prisma.package.deleteMany({ where: { tenantId } });
});

describe("purgeExpiredPhotos", () => {
  it("borra la foto de un paquete cerrado hace más de 30 días y limpia la columna", async () => {
    const url = `${BASE}/packages/${tenantId}/vieja.jpg`;
    const p = await pkg({ closedDaysAgo: 40, photoUrl: url });

    const r = await purgeExpiredPhotos(NOW);
    expect(r.photosDeleted).toBeGreaterThanOrEqual(1);
    expect(removed).toContain(url);

    const row = await prisma.package.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.photoUrl).toBeNull();
  });

  it("NO toca un paquete cerrado hace menos de 30 días", async () => {
    const url = `${BASE}/packages/${tenantId}/reciente.jpg`;
    const p = await pkg({ closedDaysAgo: 10, photoUrl: url });

    await purgeExpiredPhotos(NOW);
    expect(removed).not.toContain(url);
    const row = await prisma.package.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.photoUrl).toBe(url);
  });

  it("NUNCA toca un paquete pendiente, sin importar la antigüedad", async () => {
    const url = `${BASE}/packages/${tenantId}/pendiente-viejo.jpg`;
    const p = await pkg({ status: "awaiting_pickup", closedDaysAgo: 200, photoUrl: url });

    await purgeExpiredPhotos(NOW);
    expect(removed).not.toContain(url);
    const row = await prisma.package.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.photoUrl).toBe(url);
  });

  it("si el bucket falla, la fila queda intacta y la próxima corrida reintenta", async () => {
    const url = `${BASE}/packages/${tenantId}/atascada.jpg`;
    const p = await pkg({ closedDaysAgo: 40, photoUrl: url });
    removeShouldFail = true;

    const r = await purgeExpiredPhotos(NOW);
    expect(r.failed).toBeGreaterThanOrEqual(1);
    // El orden bucket-primero-fila-después es lo que evita filas apuntando a
    // archivos que ya no existen.
    const row = await prisma.package.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.photoUrl).toBe(url);

    removeShouldFail = false;
    await purgeExpiredPhotos(NOW);
    expect(
      (await prisma.package.findUniqueOrThrow({ where: { id: p.id } })).photoUrl,
    ).toBeNull();
  });

  it("también cubre paquetes cancelados", async () => {
    const url = `${BASE}/packages/${tenantId}/cancelada.jpg`;
    await pkg({ status: "cancelled", closedDaysAgo: 40, photoUrl: url });
    await purgeExpiredPhotos(NOW);
    expect(removed).toContain(url);
  });
});

describe("purgeOrphanPhotos", () => {
  const obj = (key: string, ageHours: number): StoredObject => ({
    key,
    url: `${BASE}/${key}`,
    lastModified: new Date(NOW.getTime() - ageHours * 60 * 60 * 1000),
  });

  it("borra lo que ninguna fila referencia, respetando la ventana de 24h", async () => {
    const referenced = `packages/${tenantId}/con-dueño.jpg`;
    await pkg({ closedDaysAgo: 1, photoUrl: `${BASE}/${referenced}` });

    listing = [
      obj(referenced, 48), // referenciada → queda
      obj(`packages/${tenantId}/huérfana-vieja.jpg`, 48), // huérfana y vieja → se va
      obj(`packages/${tenantId}/huérfana-fresca.jpg`, 2), // form quizá abierto → queda
    ];

    const r = await purgeOrphanPhotos(NOW);
    expect(r.orphansDeleted).toBe(1);
    expect(removed).toEqual([`${BASE}/packages/${tenantId}/huérfana-vieja.jpg`]);
  });

  it("un objeto sin fecha no se toca — mejor basura que borrar de más", async () => {
    listing = [
      { key: "packages/x/sin-fecha.jpg", url: `${BASE}/packages/x/sin-fecha.jpg`, lastModified: null },
    ];
    const r = await purgeOrphanPhotos(NOW);
    expect(r.orphansDeleted).toBe(0);
    expect(removed).toEqual([]);
  });
});
