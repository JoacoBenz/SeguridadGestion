import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { registerPackage } from "@/server/packages/register";
import { setSessionResolver, resetSessionResolver } from "@/lib/auth";
import {
  setWhatsAppClient,
  type SendTemplateInput,
  type WhatsAppClient,
} from "@/lib/whatsapp/client";
import { setStorageClient, type StorageClient } from "@/lib/storage/client";

// Integración contra Postgres real: registerPackage coordina la creación del
// paquete, el audit y el fan-out de WhatsApp, y esa coordinación no se puede
// verificar con módulos puros. WhatsApp y storage van stubeados — no se
// contacta ningún servicio externo.

const prisma = new PrismaClient();

const sent: SendTemplateInput[] = [];
const fakeWhatsApp: WhatsAppClient = {
  async sendTemplate(input) {
    sent.push(input);
    return { providerMessageId: `stub-${sent.length}` };
  },
};

const PHOTO_URL = "https://bucket.test/paquetes/packages/t/abc.jpg";
const fakeStorage: StorageClient = {
  isConfigured: true,
  async put() {
    return { url: PHOTO_URL };
  },
  async remove() {},
  isOwnUrl: (url) => url.startsWith("https://bucket.test/paquetes/"),
  keyOf: (url) =>
    url.startsWith("https://bucket.test/paquetes/")
      ? url.slice("https://bucket.test/paquetes/".length)
      : null,
  async list() {
    return [];
  },
};

let tenantId: string;
let unitId: string;
let guardId: string;
// User.phone es único global, así que no puede ser una constante: dos corridas
// (o el seed) chocarían.
let residentPhone: string;

const templatesSent = () => sent.map((s) => s.template);

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  residentPhone = `+54911${String(Date.now()).slice(-8)}`;
  const tenant = await prisma.tenant.create({
    data: { slug: `it-register-${suffix}`, name: "Edificio Test" },
  });
  tenantId = tenant.id;

  const unit = await prisma.unit.create({
    data: { tenantId, label: "3B" },
  });
  unitId = unit.id;

  const guard = await prisma.user.create({
    data: {
      tenantId,
      email: `guard-${suffix}@test.local`,
      name: "Guardia",
      role: "guard",
    },
  });
  guardId = guard.id;

  const resident = await prisma.user.create({
    data: {
      tenantId,
      email: `resident-${suffix}@test.local`,
      name: "Juan",
      role: "resident",
      phone: residentPhone,
    },
  });
  // UnitResident no lleva tenantId: se llega por la unidad.
  await prisma.unitResident.create({
    data: { unitId, userId: resident.id },
  });
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

afterEach(async () => {
  resetSessionResolver();
  setWhatsAppClient(null);
  setStorageClient(null);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: {} },
  });
});

describe("registerPackage — qué mensajes salen", () => {
  it("con foto manda el aviso con QR y además la foto", async () => {
    await registerPackage({ tenantId, unitId, photoUrl: PHOTO_URL });
    expect(templatesSent()).toEqual(["paquete_recibido_v3", "paquete_foto_v1"]);
  });

  it("SIN foto manda sólo el aviso con QR, nunca 'esta es la foto del paquete'", async () => {
    await registerPackage({ tenantId, unitId });
    expect(templatesSent()).toEqual(["paquete_recibido_v3"]);
    expect(templatesSent()).not.toContain("paquete_foto_v1");
  });

  it("sin foto tampoco manda la copia a la conserjería, aunque haya teléfono", async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { conserjeriaPhone: "+5491100000000" } },
    });
    await registerPackage({ tenantId, unitId });
    expect(templatesSent()).toEqual(["paquete_recibido_v3"]);
  });

  it("con foto y teléfono de conserjería manda las tres", async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { conserjeriaPhone: "+5491100000000" } },
    });
    await registerPackage({ tenantId, unitId, photoUrl: PHOTO_URL });
    expect(templatesSent()).toEqual([
      "paquete_recibido_v3",
      "paquete_foto_v1",
      "paquete_foto_v1",
    ]);
    expect(sent[2]!.to).toBe("+5491100000000");
  });
});

describe("registerPackage — invariantes", () => {
  it("rechaza una photoUrl que no salió de nuestro storage", async () => {
    await expect(
      registerPackage({ tenantId, unitId, photoUrl: "https://evil.example/x.jpg" }),
    ).rejects.toThrow("INVALID_PHOTO_URL");
    expect(sent).toHaveLength(0);
  });

  it("deja el paquete pendiente con código y token, y escribe el audit", async () => {
    const result = await registerPackage({ tenantId, unitId });
    const pkg = await prisma.package.findUniqueOrThrow({ where: { id: result.packageId } });
    expect(pkg.status).toBe("awaiting_pickup");
    expect(pkg.pickupCode).toBe(result.pickupCode);
    expect(pkg.pickupToken).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId, entityId: result.packageId, action: "package.registered" },
    });
    expect(audit).not.toBeNull();
  });

  it("informa a quién se notificó, para que la conserjería pueda avisar si no fue a nadie", async () => {
    const result = await registerPackage({ tenantId, unitId });
    expect(result.notifiedPhones).toEqual([residentPhone]);
  });

  it("no registra paquetes si la suscripción está inactiva", async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "suspended" },
    });
    await expect(registerPackage({ tenantId, unitId })).rejects.toThrow(
      "SUBSCRIPTION_INACTIVE",
    );
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "active" },
    });
  });
});
