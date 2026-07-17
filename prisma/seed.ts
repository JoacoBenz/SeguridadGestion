import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const superadmin = await prisma.user.upsert({
    where: { email: "super@paqueteok.test" },
    update: { role: Role.superadmin, tenantId: null, name: "Operador SaaS" },
    create: {
      role: Role.superadmin,
      tenantId: null,
      name: "Operador SaaS",
      email: "super@paqueteok.test",
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "edificio-libertad" },
    update: { subscriptionStatus: "active" },
    create: {
      slug: "edificio-libertad",
      name: "Edificio Libertad",
      address: "Av. Libertador 1234, CABA",
      // El edificio de prueba siempre operativo para desarrollo.
      subscriptionStatus: "active",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@edificio-libertad.test" },
    update: { tenantId: tenant.id, role: Role.admin, name: "Administración" },
    create: {
      tenantId: tenant.id,
      role: Role.admin,
      name: "Administración",
      email: "admin@edificio-libertad.test",
    },
  });

  const guard = await prisma.user.upsert({
    where: { email: "guardia@edificio-libertad.test" },
    update: { tenantId: tenant.id, role: Role.guard, name: "Conserjería 24hs" },
    create: {
      tenantId: tenant.id,
      role: Role.guard,
      name: "Conserjería 24hs",
      email: "guardia@edificio-libertad.test",
    },
  });

  const unitLabels = ["1A", "1B", "2A", "2B", "3A", "3B"];
  for (const [i, label] of unitLabels.entries()) {
    const unit = await prisma.unit.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label } },
      update: {},
      create: { tenantId: tenant.id, label },
    });

    const residentEmail = `${label.toLowerCase()}@edificio-libertad.test`;
    const resident = await prisma.user.upsert({
      where: { email: residentEmail },
      update: {
        tenantId: tenant.id,
        role: Role.resident,
        name: `Residente ${label}`,
        phone: `+549119900${String(i + 1).padStart(4, "0")}`,
      },
      create: {
        tenantId: tenant.id,
        role: Role.resident,
        name: `Residente ${label}`,
        email: residentEmail,
        // E.164 válido — nada de letras del label acá. Prefijo 99 para no chocar
        // con datos cargados a mano en la DB de dev.
        phone: `+549119900${String(i + 1).padStart(4, "0")}`,
      },
    });

    await prisma.unitResident.upsert({
      where: { unitId_userId: { unitId: unit.id, userId: resident.id } },
      update: {},
      create: { unitId: unit.id, userId: resident.id, isPrimary: true },
    });
  }

  console.log("Seed listo.");
  console.log(`Tenant:     ${tenant.slug}`);
  console.log(`Superadmin: ${superadmin.email}`);
  console.log(`Admin:      ${admin.email}`);
  console.log(`Guard:      ${guard.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
