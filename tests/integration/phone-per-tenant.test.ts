import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

// El caso real: el hijo quiere recibir los WhatsApp del depto de la madre en
// OTRO edificio. El teléfono es único por edificio, no global — este test fija
// esa regla contra la base real (el índice vive en una migración).

const stamp = Date.now().toString().slice(-7);
const PHONE = `+54911${stamp}00`;
let tenantA = "";
let tenantB = "";

beforeAll(async () => {
  tenantA = (
    await prisma.tenant.create({
      data: { slug: `phone-a-${stamp}`, name: "Edificio A" },
    })
  ).id;
  tenantB = (
    await prisma.tenant.create({
      data: { slug: `phone-b-${stamp}`, name: "Edificio B" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await prisma.$disconnect();
});

describe("teléfono único por edificio", () => {
  it("el mismo número puede ser residente en dos edificios distintos", async () => {
    await prisma.user.create({
      data: { tenantId: tenantA, role: "resident", name: "Hijo en A", phone: PHONE },
    });
    const enB = await prisma.user.create({
      data: { tenantId: tenantB, role: "resident", name: "Hijo avisos de mamá", phone: PHONE },
    });
    expect(enB.phone).toBe(PHONE);
  });

  it("dentro del mismo edificio el número duplicado se rechaza (P2002)", async () => {
    await expect(
      prisma.user.create({
        data: { tenantId: tenantA, role: "resident", name: "Duplicado", phone: PHONE },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("varios usuarios sin teléfono en el mismo edificio no chocan entre sí", async () => {
    // NULL no participa del índice único: admins y usuarios de dispositivo no
    // tienen teléfono y tiene que poder haber varios.
    await prisma.user.create({
      data: { tenantId: tenantA, role: "admin", name: "Admin 1", phone: null },
    });
    const second = await prisma.user.create({
      data: { tenantId: tenantA, role: "admin", name: "Admin 2", phone: null },
    });
    expect(second.id).toBeTruthy();
  });
});
