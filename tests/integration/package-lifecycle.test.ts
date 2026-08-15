import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { registerPackage } from "@/server/packages/register";
import { pickupPackage } from "@/server/packages/pickup";
import { cancelPackage } from "@/server/packages/cancel";
import { setSessionResolver, resetSessionResolver } from "@/lib/auth";
import {
  setWhatsAppClient,
  type SendTemplateInput,
  type WhatsAppClient,
} from "@/lib/whatsapp/client";
import { setStorageClient, type StorageClient } from "@/lib/storage/client";

// Las transiciones de estado del paquete contra Postgres real. Lo que se fija
// acá es lo que ningún módulo puro puede: que el update condicional impida el
// doble retiro, que un paquete cancelado no se pueda retirar, y que cada
// transición deje su audit.

const prisma = new PrismaClient();

const sent: SendTemplateInput[] = [];
const fakeWhatsApp: WhatsAppClient = {
  async sendTemplate(input) {
    sent.push(input);
    return { providerMessageId: `stub-${sent.length}` };
  },
};

const fakeStorage: StorageClient = {
  isConfigured: false,
  async put() {
    return { url: "dev-storage://x" };
  },
  async remove() {},
  async signedUrl(url) {
    return `${url}?sig=test`;
  },
  isOwnUrl: () => true,
  keyOf: () => null,
  async list() {
    return [];
  },
};

let tenantId: string;
let unitId: string;
let guardId: string;

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const tenant = await prisma.tenant.create({
    data: { slug: `it-lifecycle-${suffix}`, name: "Edificio Test" },
  });
  tenantId = tenant.id;
  unitId = (await prisma.unit.create({ data: { tenantId, label: "5C" } })).id;
  guardId = (
    await prisma.user.create({
      data: {
        tenantId,
        email: `guard-lc-${suffix}@test.local`,
        name: "Guardia",
        role: "guard",
      },
    })
  ).id;
  const resident = await prisma.user.create({
    data: {
      tenantId,
      email: `res-lc-${suffix}@test.local`,
      name: "Ana",
      role: "resident",
      phone: `+54911${String(Date.now()).slice(-8)}`,
    },
  });
  await prisma.unitResident.create({ data: { unitId, userId: resident.id } });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { package: { tenantId } } });
  await prisma.package.deleteMany({ where: { tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.unitResident.deleteMany({ where: { unit: { tenantId } } });
  await prisma.unit.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
});

beforeEach(() => {
  sent.length = 0;
  setWhatsAppClient(fakeWhatsApp);
  setStorageClient(fakeStorage);
  setSessionResolver(async () => ({
    userId: guardId,
    tenantId,
    role: "guard",
    name: "Guardia",
  }));
});

afterEach(() => {
  resetSessionResolver();
  setWhatsAppClient(null);
  setStorageClient(null);
});

const newPackage = () => registerPackage({ tenantId, unitId });

describe("pickupPackage", () => {
  it("retira por código y avisa al residente", async () => {
    const pkg = await newPackage();
    sent.length = 0;

    const result = await pickupPackage({ tenantId, pickupCode: pkg.pickupCode });
    expect(result.unitLabel).toBe("5C");
    expect(sent.map((s) => s.template)).toEqual(["paquete_retirado_v1"]);

    const row = await prisma.package.findUniqueOrThrow({ where: { id: pkg.packageId } });
    expect(row.status).toBe("picked_up");
    expect(row.pickedUpAt).not.toBeNull();
    expect(row.pickedUpByUserId).toBe(guardId);
  });

  it("retira por token del QR", async () => {
    const pkg = await newPackage();
    const result = await pickupPackage({ tenantId, pickupToken: pkg.pickupToken });
    expect(result.packageId).toBe(pkg.packageId);
  });

  it("el resultado trae la foto del ingreso FIRMADA y el transportista", async () => {
    // La foto es la que ve el guardia en el popup para saber cuál agarrar del
    // depósito. Firmada (bucket privado) y nunca la canónica.
    const pkg = await registerPackage({
      tenantId,
      unitId,
      carrier: "Andreani",
      photoUrl: "https://bucket.test/paquetes/packages/t/retiro.jpg",
    });
    const result = await pickupPackage({ tenantId, pickupCode: pkg.pickupCode });
    expect(result.photoUrl).toBe("https://bucket.test/paquetes/packages/t/retiro.jpg?sig=test");
    expect(result.carrier).toBe("Andreani");
  });

  it("sin foto, el resultado trae photoUrl null (no una URL rota)", async () => {
    const pkg = await newPackage();
    const result = await pickupPackage({ tenantId, pickupCode: pkg.pickupCode });
    expect(result.photoUrl).toBeNull();
    expect(result.carrier).toBeNull();
  });

  it("dos guardias escaneando el mismo QR: sólo uno retira", async () => {
    const pkg = await newPackage();
    // El update condicional es lo que decide; Promise.allSettled deja ver que
    // uno gana y el otro recibe PACKAGE_NOT_FOUND en vez de pisar el retiro.
    const [a, b] = await Promise.allSettled([
      pickupPackage({ tenantId, pickupToken: pkg.pickupToken }),
      pickupPackage({ tenantId, pickupToken: pkg.pickupToken }),
    ]);
    const ok = [a, b].filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
  });

  it("un código inexistente no retira nada", async () => {
    await expect(
      pickupPackage({ tenantId, pickupCode: "H7K2MD" }),
    ).rejects.toThrow("PACKAGE_NOT_FOUND");
  });

  it("un código con formato inválido se rechaza antes de tocar la base", async () => {
    // El alfabeto excluye 0/O/1/I/L/U justamente para que no se confundan al
    // dictarlos por teléfono.
    await expect(pickupPackage({ tenantId, pickupCode: "OOLLII" })).rejects.toThrow(
      "INVALID_CODE",
    );
  });

  it("no se puede retirar dos veces", async () => {
    const pkg = await newPackage();
    await pickupPackage({ tenantId, pickupCode: pkg.pickupCode });
    await expect(
      pickupPackage({ tenantId, pickupCode: pkg.pickupCode }),
    ).rejects.toThrow("PACKAGE_NOT_FOUND");
  });

  it("deja el audit del retiro", async () => {
    const pkg = await newPackage();
    await pickupPackage({ tenantId, pickupCode: pkg.pickupCode });
    const audit = await prisma.auditLog.findFirst({
      where: { tenantId, entityId: pkg.packageId, action: "package.picked_up" },
    });
    expect(audit).not.toBeNull();
  });
});

describe("cancelPackage", () => {
  it("cancela un pendiente con motivo y deja audit", async () => {
    const pkg = await newPackage();
    await cancelPackage({ tenantId, packageId: pkg.packageId, reason: "Mal direccionado" });

    const row = await prisma.package.findUniqueOrThrow({ where: { id: pkg.packageId } });
    expect(row.status).toBe("cancelled");
    expect(row.cancelledReason).toBe("Mal direccionado");

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId, entityId: pkg.packageId, action: "package.cancelled" },
    });
    expect(audit).not.toBeNull();
  });

  it("un paquete ya retirado no se puede cancelar", async () => {
    const pkg = await newPackage();
    await pickupPackage({ tenantId, pickupCode: pkg.pickupCode });
    await expect(
      cancelPackage({ tenantId, packageId: pkg.packageId, reason: "tarde" }),
    ).rejects.toThrow("PACKAGE_NOT_CANCELLABLE");
  });

  it("un paquete cancelado ya no se puede retirar", async () => {
    const pkg = await newPackage();
    await cancelPackage({ tenantId, packageId: pkg.packageId, reason: "devuelto" });
    await expect(
      pickupPackage({ tenantId, pickupCode: pkg.pickupCode }),
    ).rejects.toThrow("PACKAGE_NOT_FOUND");
  });
});

describe("aislamiento entre edificios", () => {
  it("no se retira un paquete de otro edificio con su código", async () => {
    const pkg = await newPackage();
    const otherId = (
      await prisma.tenant.create({
        data: {
          slug: `it-other-${Math.random().toString(36).slice(2, 8)}`,
          name: "Otro",
        },
      })
    ).id;

    // Sesión válida en el otro edificio, código válido en éste: el tenantId del
    // where es lo único que lo impide.
    setSessionResolver(async () => ({
      userId: guardId,
      tenantId: otherId,
      role: "guard",
      name: "Guardia",
    }));
    await expect(
      pickupPackage({ tenantId: otherId, pickupCode: pkg.pickupCode }),
    ).rejects.toThrow("PACKAGE_NOT_FOUND");

    await prisma.tenant.delete({ where: { id: otherId } });
  });

  it("una sesión de otro edificio no puede retirar acá", async () => {
    const pkg = await newPackage();
    setSessionResolver(async () => ({
      userId: guardId,
      tenantId: "otro-tenant-id",
      role: "guard",
      name: "Guardia",
    }));
    await expect(
      pickupPackage({ tenantId, pickupCode: pkg.pickupCode }),
    ).rejects.toThrow("FORBIDDEN_TENANT");
  });

  it("un residente no puede retirar paquetes", async () => {
    const pkg = await newPackage();
    setSessionResolver(async () => ({
      userId: guardId,
      tenantId,
      role: "resident",
      name: "Ana",
    }));
    await expect(
      pickupPackage({ tenantId, pickupCode: pkg.pickupCode }),
    ).rejects.toThrow("FORBIDDEN_ROLE");
  });
});
