import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { sendPendingReminders } from "@/server/packages/reminders";
import {
  setWhatsAppClient,
  type SendTemplateInput,
  type WhatsAppClient,
} from "@/lib/whatsapp/client";

// El cron de recordatorios corre sin sesión (lo dispara Vercel), así que acá no
// hace falta stubear auth. Lo que se fija es que sea idempotente entre
// corridas: es lo que evita bombardear al residente si el cron se dispara dos
// veces, y no se puede verificar sin la tabla de Notification real.

const prisma = new PrismaClient();

const sent: SendTemplateInput[] = [];
const fakeWhatsApp: WhatsAppClient = {
  async sendTemplate(input) {
    sent.push(input);
    return { providerMessageId: `stub-${Math.random()}` };
  },
};

const DAY = 24 * 60 * 60 * 1000;

let tenantId: string;
let unitId: string;
let guardId: string;

async function packageReceivedDaysAgo(days: number): Promise<string> {
  const pkg = await prisma.package.create({
    data: {
      tenantId,
      unitId,
      receivedByUserId: guardId,
      pickupCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      receivedAt: new Date(Date.now() - days * DAY),
    },
  });
  return pkg.id;
}

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const tenant = await prisma.tenant.create({
    data: { slug: `it-rem-${suffix}`, name: "Edificio Test" },
  });
  tenantId = tenant.id;
  unitId = (await prisma.unit.create({ data: { tenantId, label: "7A" } })).id;
  guardId = (
    await prisma.user.create({
      data: {
        tenantId,
        email: `guard-rem-${suffix}@test.local`,
        name: "Guardia",
        role: "guard",
      },
    })
  ).id;
  const resident = await prisma.user.create({
    data: {
      tenantId,
      email: `res-rem-${suffix}@test.local`,
      name: "Leo",
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
});

afterEach(async () => {
  setWhatsAppClient(null);
  await prisma.notification.deleteMany({ where: { package: { tenantId } } });
  await prisma.package.deleteMany({ where: { tenantId } });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionStatus: "active" },
  });
});

// Sólo miramos lo de este tenant: la corrida barre toda la base.
const remindersHere = async () =>
  prisma.notification.count({
    where: { package: { tenantId }, templateName: "paquete_pendiente_v1" },
  });

describe("sendPendingReminders", () => {
  it("no molesta por un paquete que llegó recién", async () => {
    await packageReceivedDaysAgo(1);
    await sendPendingReminders();
    expect(await remindersHere()).toBe(0);
  });

  it("recuerda uno que lleva más de 3 días esperando", async () => {
    await packageReceivedDaysAgo(5);
    await sendPendingReminders();
    expect(await remindersHere()).toBe(1);
  });

  it("es idempotente: correrlo dos veces no duplica el recordatorio", async () => {
    await packageReceivedDaysAgo(5);
    await sendPendingReminders();
    await sendPendingReminders();
    // Es lo que evita bombardear al residente si el cron se dispara de más.
    expect(await remindersHere()).toBe(1);
  });

  it("no recuerda paquetes ya retirados", async () => {
    const id = await packageReceivedDaysAgo(5);
    await prisma.package.update({
      where: { id },
      data: { status: "picked_up", pickedUpAt: new Date() },
    });
    await sendPendingReminders();
    expect(await remindersHere()).toBe(0);
  });

  it("no recuerda paquetes cancelados", async () => {
    const id = await packageReceivedDaysAgo(5);
    await prisma.package.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    await sendPendingReminders();
    expect(await remindersHere()).toBe(0);
  });

  it("saltea los edificios suspendidos", async () => {
    await packageReceivedDaysAgo(5);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "suspended" },
    });
    await sendPendingReminders();
    expect(await remindersHere()).toBe(0);
  });

  it("deja el audit del recordatorio", async () => {
    const id = await packageReceivedDaysAgo(5);
    await sendPendingReminders();
    const audit = await prisma.auditLog.findFirst({
      where: { tenantId, entityId: id, action: "package.reminder_sent" },
    });
    expect(audit).not.toBeNull();
    await prisma.auditLog.deleteMany({ where: { tenantId } });
  });
});
