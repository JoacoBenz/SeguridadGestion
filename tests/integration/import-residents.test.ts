import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { importResidentsAction } from "@/server/admin/residents";
import { setSessionResolver, resetSessionResolver } from "@/lib/auth";

// El import masivo escribe unidades y residentes de a cientos: es la acción
// con más capacidad de daño del panel. Contra Postgres real.
//
// Las server actions terminan en redirect(), que en Next se implementa
// TIRANDO un error con digest "NEXT_REDIRECT;...;url;...". Para testear hay
// que capturarlo y mirar a dónde mandaba.

const prisma = new PrismaClient();

let tenantId: string;
let slug: string;
let adminId: string;

async function runImport(csv: string): Promise<string> {
  const fd = new FormData();
  fd.set("csv", csv);
  try {
    await importResidentsAction(slug, fd);
  } catch (err) {
    const digest = (err as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) {
      // digest = NEXT_REDIRECT;<tipo>;<url>;<status>;
      return decodeURIComponent(digest.split(";")[2] ?? "");
    }
    throw err;
  }
  throw new Error("la action no redirigió — no debería pasar");
}

// Teléfonos únicos por corrida: User.phone es único global.
const stamp = String(Date.now()).slice(-6);
// 11 (área) + stamp(6) + n(2) = NSN de 10 dígitos, como exige un móvil AR.
const phone = (n: number) => `+54911${stamp}${String(n).padStart(2, "0")}`;

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  slug = `it-imp-${suffix}`;
  tenantId = (
    await prisma.tenant.create({ data: { slug, name: "Import Test" } })
  ).id;
  adminId = (
    await prisma.user.create({
      data: { tenantId, email: `adm-${suffix}@test.local`, name: "Admin", role: "admin" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.unitResident.deleteMany({ where: { unit: { tenantId } } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.unit.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
});

beforeEach(() => {
  setSessionResolver(async () => ({
    userId: adminId,
    tenantId,
    role: "admin",
    name: "Admin",
  }));
});

afterEach(async () => {
  resetSessionResolver();
  await prisma.unitResident.deleteMany({ where: { unit: { tenantId } } });
  await prisma.user.deleteMany({ where: { tenantId, role: "resident" } });
  await prisma.unit.deleteMany({ where: { tenantId } });
});

describe("importResidentsAction", () => {
  it("crea unidades y residentes vinculados, y redirige con el resumen", async () => {
    const url = await runImport(
      `unidad,nombre,telefono,email\n` +
        `3B,Uno Test,${phone(1)},uno-${stamp}@t.local\n` +
        `5A,Dos Test,${phone(2)},`,
    );
    expect(url).toContain("/admin/residentes?ok=");
    expect(url).toContain("Se importaron 2");

    expect(await prisma.unit.count({ where: { tenantId } })).toBe(2);
    const residents = await prisma.user.findMany({
      where: { tenantId, role: "resident" },
      include: { unitMemberships: true },
    });
    expect(residents).toHaveLength(2);
    // Todos quedaron vinculados a su unidad — un residente sin vínculo no
    // recibiría nunca un aviso.
    expect(residents.every((r) => r.unitMemberships.length === 1)).toBe(true);
  });

  it("un teléfono ya existente se saltea sin frenar al resto, y el resumen lo dice", async () => {
    await runImport(`unidad,nombre,telefono\n1A,Original Test,${phone(10)}`);
    const url = await runImport(
      `unidad,nombre,telefono\n1B,Duplicado Test,${phone(10)}\n1C,Nuevo Test,${phone(11)}`,
    );
    expect(url).toContain("Se importaron 1");
    expect(url).toContain("saltearon 1");
    // El duplicado no pisó al original.
    const original = await prisma.user.findFirst({ where: { phone: phone(10) } });
    expect(original!.name).toBe("Original Test");
  });

  it("con CUALQUIER fila inválida no escribe NADA — todo o nada", async () => {
    const url = await runImport(
      `unidad,nombre,telefono\n2A,Válido Test,${phone(20)}\nZZZ,Inválido Test,noesnumero`,
    );
    expect(url).toContain("error=");
    expect(await prisma.unit.count({ where: { tenantId } })).toBe(0);
    expect(
      await prisma.user.count({ where: { tenantId, role: "resident" } }),
    ).toBe(0);
  });

  it("re-importar el mismo CSV no duplica unidades (upsert por etiqueta)", async () => {
    const csv = `unidad,nombre,telefono\n4D,Rep Uno,${phone(30)}`;
    await runImport(csv);
    await runImport(
      `unidad,nombre,telefono\n4D,Rep Dos,${phone(31)}`,
    );
    expect(await prisma.unit.count({ where: { tenantId, label: "4D" } })).toBe(1);
    // Y los dos residentes cuelgan de la misma unidad.
    const unit = await prisma.unit.findFirstOrThrow({
      where: { tenantId, label: "4D" },
      include: { residents: true },
    });
    expect(unit.residents).toHaveLength(2);
  });

  it("un guardia no puede importar", async () => {
    setSessionResolver(async () => ({
      userId: adminId,
      tenantId,
      role: "guard",
      name: "Guardia",
    }));
    await expect(
      importResidentsAction(slug, (() => {
        const fd = new FormData();
        fd.set("csv", `unidad,nombre,telefono\n1A,Pirata Test,${phone(40)}`);
        return fd;
      })()),
    ).rejects.toThrow("FORBIDDEN_ROLE");
    expect(await prisma.unit.count({ where: { tenantId } })).toBe(0);
  });

  it("deja el audit con los números de la corrida", async () => {
    await runImport(`unidad,nombre,telefono\n6F,Audit Test,${phone(50)}`);
    const audit = await prisma.auditLog.findFirst({
      where: { tenantId, action: "residents.imported" },
      orderBy: { at: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.metadata).toMatchObject({ created: 1, skipped: 0, total: 1 });
  });
});
