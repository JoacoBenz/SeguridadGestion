import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

// El alta de residente es user.create + unitResident.create. Sin transacción,
// un fallo en el segundo write dejaba un User huérfano que además ocupaba el
// índice único (tenantId, phone): el admin reintentaba y rebotaba con "ya
// existe". Este test fija la semántica de rollback del patrón que ahora usan
// createResidentAction e importResidentsAction.

const stamp = Date.now().toString().slice(-7);
const PHONE = `+54911${stamp}50`;
let tenantId = "";

beforeAll(async () => {
  tenantId = (
    await prisma.tenant.create({
      data: { slug: `tx-test-${stamp}`, name: "Edificio TX" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
});

describe("alta de residente atómica", () => {
  it("si el vínculo con la unidad falla, el User no queda creado", async () => {
    // unitId inexistente -> el segundo write viola la FK y la transacción
    // entera revierte, incluido el user.create que ya había pasado.
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { tenantId, role: "resident", name: "Fantasma", phone: PHONE },
        });
        await tx.unitResident.create({
          data: { unitId: "unidad-que-no-existe", userId: user.id, isPrimary: true },
        });
      }),
    ).rejects.toThrow();

    const orphan = await prisma.user.findFirst({ where: { tenantId, phone: PHONE } });
    expect(orphan).toBeNull();
  });

  it("y el teléfono queda libre para el reintento", async () => {
    const unit = await prisma.unit.create({
      data: { tenantId, label: `9Z-${stamp.slice(-3)}` },
    });
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { tenantId, role: "resident", name: "Reintento OK", phone: PHONE },
      });
      await tx.unitResident.create({
        data: { unitId: unit.id, userId: created.id, isPrimary: true },
      });
      return created;
    });
    expect(user.phone).toBe(PHONE);
    const membership = await prisma.unitResident.findUnique({
      where: { unitId_userId: { unitId: unit.id, userId: user.id } },
    });
    expect(membership).not.toBeNull();
  });
});
