import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

// Moca 2: edificio grande. 8 pisos × 20 deptos (A–T) = 160 unidades.
const FLOOR_COUNT = 8;
const FLOOR_LETTERS = "ABCDEFGHIJKLMNOPQRST".split("");

function generateUnitLabels(): string[] {
  const out: string[] = [];
  for (let floor = 1; floor <= FLOOR_COUNT; floor++) {
    for (const letter of FLOOR_LETTERS) {
      out.push(`${floor}${letter}`);
    }
  }
  return out;
}

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
    update: { name: "Moca 2" },
    create: {
      slug: "edificio-libertad",
      name: "Moca 2",
      address: "Moca 2, CABA",
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

  const unitLabels = generateUnitLabels();
  let unitCount = 0;
  let residentCount = 0;

  for (const label of unitLabels) {
    const unit = await prisma.unit.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label } },
      update: {},
      create: { tenantId: tenant.id, label },
    });
    unitCount++;

    // Un residente por unidad (datos sintéticos para QA del flujo).
    // Phones son ficticios — el cliente WhatsApp en dev solo loguea, no envía.
    const residentEmail = `${label.toLowerCase()}@edificio-libertad.test`;
    const resident = await prisma.user.upsert({
      where: { email: residentEmail },
      update: { tenantId: tenant.id, role: Role.resident, name: `Residente ${label}` },
      create: {
        tenantId: tenant.id,
        role: Role.resident,
        name: `Residente ${label}`,
        email: residentEmail,
        phone: `+549110000${String(unitCount).padStart(4, "0")}`,
      },
    });
    residentCount++;

    await prisma.unitResident.upsert({
      where: { unitId_userId: { unitId: unit.id, userId: resident.id } },
      update: {},
      create: { unitId: unit.id, userId: resident.id, isPrimary: true },
    });
  }

  await seedDemoData(tenant.id, admin.id, guard.id);

  console.log("Seed listo.");
  console.log(`Tenant:     ${tenant.slug} (${tenant.name})`);
  console.log(`Superadmin: ${superadmin.email}`);
  console.log(`Admin:      ${admin.email}`);
  console.log(`Guard:      ${guard.email}`);
  console.log(`Unidades:   ${unitCount}`);
  console.log(`Residentes: ${residentCount}`);
}

// Wipes and recreates demo rows for the new portero virtual domains so the
// UI shows something useful on first boot. Idempotent — safe to re-run.
async function seedDemoData(tenantId: string, adminId: string, guardId: string) {
  // 1. wipe existing demo rows in this tenant
  await prisma.$transaction([
    prisma.visitorEvent.deleteMany({ where: { tenantId } }),
    prisma.recurringAuthorization.deleteMany({ where: { tenantId } }),
    prisma.issue.deleteMany({ where: { tenantId } }),
    prisma.broadcast.deleteMany({ where: { tenantId } }),
    prisma.faqEntry.deleteMany({ where: { tenantId } }),
    prisma.lostFoundItem.deleteMany({ where: { tenantId } }),
    prisma.user.updateMany({
      where: { tenantId, role: Role.resident },
      data: { vacationStart: null, vacationEnd: null },
    }),
  ]);

  // 2. grab a few residents to use as actors / targets
  const residents = await prisma.user.findMany({
    where: { tenantId, role: Role.resident },
    include: { unitMemberships: { include: { unit: true } } },
    take: 8,
    orderBy: { name: "asc" },
  });
  if (residents.length === 0) return;

  const r = (i: number) => residents[i % residents.length]!;
  const unitOf = (i: number) => r(i).unitMemberships[0]?.unit;

  // 3. Recurring authorizations
  await prisma.recurringAuthorization.createMany({
    data: [
      {
        tenantId,
        unitId: unitOf(0)!.id,
        createdByUserId: r(0).id,
        name: "Marcela (mucama)",
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: "08:00",
        endTime: "12:00",
        status: "active",
      },
      {
        tenantId,
        unitId: unitOf(1)!.id,
        createdByUserId: r(1).id,
        name: "Diego (paseador)",
        daysOfWeek: [1, 3, 5],
        startTime: "07:00",
        endTime: "08:00",
        status: "active",
      },
      {
        tenantId,
        unitId: unitOf(2)!.id,
        createdByUserId: r(2).id,
        name: "Profe de yoga (Ana)",
        daysOfWeek: [2, 4],
        startTime: "10:00",
        endTime: "11:00",
        status: "paused",
      },
    ],
  });

  // 4. VisitorEvents — a couple announced for today + 1 pending door prompt
  const now = new Date();
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h!, m!, 0, 0);
  };
  await prisma.visitorEvent.createMany({
    data: [
      {
        tenantId,
        unitId: unitOf(3)!.id,
        kind: "announced",
        visitorName: "Juan Pérez",
        expectedTime: at("19:30"),
        status: "confirmed",
        requestedByUserId: r(3).id,
      },
      {
        tenantId,
        unitId: unitOf(4)!.id,
        kind: "announced",
        visitorName: "María González",
        expectedTime: at("20:00"),
        vehiclePlate: "AB123CD",
        status: "confirmed",
        requestedByUserId: r(4).id,
      },
      {
        tenantId,
        unitId: unitOf(5)!.id,
        kind: "door_prompt",
        visitorName: "Repartidor PedidosYa",
        status: "pending",
        requestedByUserId: guardId,
      },
    ],
  });

  // 5. Issues — across kinds and statuses
  await prisma.issue.createMany({
    data: [
      {
        tenantId,
        unitId: unitOf(0)!.id,
        kind: "maintenance",
        severity: "normal",
        status: "open",
        title: "Pérdida de agua caliente en cocina",
        body: "Desde anoche no sale agua caliente en la cocina. La de la ducha funciona.",
        reportedByUserId: r(0).id,
        reportedByRole: Role.resident,
      },
      {
        tenantId,
        unitId: unitOf(1)!.id,
        kind: "noise",
        severity: "normal",
        status: "acknowledged",
        title: "Música fuerte en el 3C",
        body: "Música fuerte después de las 23 hs. Tres noches seguidas.",
        reportedByUserId: r(1).id,
        reportedByRole: Role.resident,
        acknowledgedByUserId: adminId,
        acknowledgedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      },
      {
        tenantId,
        unitId: null,
        kind: "suspicious",
        severity: "high",
        status: "open",
        title: "Persona merodeando en la entrada",
        body: "Una persona caminaba frente a la entrada hace 20 minutos, intentó tocar timbres.",
        reportedByUserId: guardId,
        reportedByRole: Role.guard,
      },
      {
        tenantId,
        unitId: unitOf(2)!.id,
        kind: "panic",
        severity: "critical",
        status: "resolved",
        title: "Botón de pánico",
        body: "Botón de pánico activado desde el bot — falsa alarma según la residente.",
        reportedByUserId: r(2).id,
        reportedByRole: Role.resident,
        acknowledgedByUserId: adminId,
        acknowledgedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        resolvedByUserId: adminId,
        resolvedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
        resolutionNote: "Confirmada falsa alarma. Activación accidental.",
      },
      {
        tenantId,
        unitId: null,
        kind: "incident",
        severity: "normal",
        status: "resolved",
        title: "Cierre defectuoso del portón vehicular",
        body: "El portón no cerró completamente después de las 22 hs. Se reactivó manualmente.",
        reportedByUserId: guardId,
        reportedByRole: Role.guard,
        resolvedByUserId: adminId,
        resolvedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
        resolutionNote: "Llamado al servicio técnico. Pasan mañana.",
      },
    ],
  });

  // 6. Broadcasts — historical sends
  await prisma.broadcast.createMany({
    data: [
      {
        tenantId,
        sentByUserId: adminId,
        subject: "Corte de agua programado",
        body: "Mañana de 09 a 12 hs habrá corte programado de agua por mantenimiento.",
        recipientCount: 160,
        sentAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        sentByUserId: adminId,
        subject: "Asamblea ordinaria",
        body: "Recordamos asamblea ordinaria el sábado 21:00 hs en el SUM.",
        recipientCount: 158,
        sentAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // 7. FAQ entries
  await prisma.faqEntry.createMany({
    data: [
      {
        tenantId,
        ordinal: 1,
        question: "¿Cuándo se sacan los residuos reciclables?",
        answer: "Los martes y viernes a partir de las 21 hs. Solo en bolsas verdes.",
      },
      {
        tenantId,
        ordinal: 2,
        question: "¿Cuál es el horario del SUM?",
        answer: "De 09 a 23 hs. Se reserva con 48 hs de anticipación con administración.",
      },
      {
        tenantId,
        ordinal: 3,
        question: "¿Cómo reservo la parrilla?",
        answer: "Por WhatsApp con administración. Máximo 2 reservas por mes por unidad.",
      },
      {
        tenantId,
        ordinal: 4,
        question: "¿Cómo se paga la expensa?",
        answer: "Transferencia bancaria o débito automático. Recibís el detalle el día 5.",
      },
      {
        tenantId,
        ordinal: 5,
        question: "¿Se permiten mascotas?",
        answer: "Sí, hasta 2 por unidad. Deben circular con correa en áreas comunes.",
      },
    ],
  });

  // 8. Lost & found items
  await prisma.lostFoundItem.createMany({
    data: [
      {
        tenantId,
        description: "Llavero negro con dije de cuero",
        foundLocation: "Palier 1er piso",
        postedByUserId: guardId,
        status: "lost",
        foundAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        description: "Anteojos de sol con marco rojo",
        foundLocation: "Ascensor torre A",
        postedByUserId: guardId,
        status: "lost",
        foundAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        tenantId,
        description: "Paraguas plegable azul",
        foundLocation: "Hall de entrada",
        postedByUserId: guardId,
        status: "claimed",
        claimedByUserId: r(0).id,
        claimedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        foundAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        tenantId,
        description: "Carrito de supermercado pequeño",
        foundLocation: "Cochera",
        postedByUserId: guardId,
        status: "disposed",
        foundAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // 9. One resident on vacation (active range)
  const vacationStart = new Date(now);
  vacationStart.setHours(0, 0, 0, 0);
  vacationStart.setDate(vacationStart.getDate() - 2);
  const vacationEnd = new Date(vacationStart);
  vacationEnd.setDate(vacationEnd.getDate() + 14);
  await prisma.user.update({
    where: { id: r(6).id },
    data: { vacationStart, vacationEnd },
  });

  console.log("Datos de demo cargados:");
  console.log("  • 3 autorizaciones recurrentes (2 activas, 1 en pausa)");
  console.log("  • 3 visitas hoy (2 anunciadas + 1 door prompt pendiente)");
  console.log("  • 5 incidentes (abierto/visto/resuelto)");
  console.log("  • 2 avisos enviados");
  console.log("  • 5 entradas de FAQ");
  console.log("  • 4 objetos perdidos");
  console.log(`  • 1 residente en vacaciones (${r(6).name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
