/**
 * Borra edificios completos: paquetes, notificaciones, unidades, residentes,
 * usuarios y las fotos del bucket.
 *
 *   # 1. Ver qué edificios hay (no toca nada)
 *   pnpm tsx scripts/delete-tenant.ts
 *
 *   # 2. Ver exactamente qué se borraría (no toca nada)
 *   pnpm tsx scripts/delete-tenant.ts --slug edificio-uno --slug edificio-dos
 *
 *   # 3. Borrar de verdad
 *   pnpm tsx scripts/delete-tenant.ts --slug edificio-uno --slug edificio-dos --confirm
 *
 * Es irreversible: no hay papelera ni undo. Sacá un backup de la base antes
 * (Supabase → Database → Backups) si hay alguna chance de arrepentirse.
 */
import { PrismaClient } from "@prisma/client";
import { getStorageClient } from "../src/lib/storage/client";

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const slugs: string[] = [];
  let confirm = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--slug") slugs.push(argv[++i]!);
    else if (argv[i] === "--confirm") confirm = true;
    else {
      console.error(`Opción desconocida: ${argv[i]}`);
      process.exit(1);
    }
  }
  return { slugs, confirm };
}

async function listTenants() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      slug: true,
      name: true,
      createdAt: true,
      _count: { select: { units: true, users: true, packages: true } },
    },
  });
  if (tenants.length === 0) {
    console.log("No hay edificios cargados.");
    return;
  }
  console.log(`\n${tenants.length} edificio(s):\n`);
  for (const t of tenants) {
    console.log(`  ${t.slug}`);
    console.log(`    nombre:    ${t.name}`);
    console.log(`    creado:    ${t.createdAt.toISOString().slice(0, 10)}`);
    console.log(
      `    contenido: ${t._count.units} unidades · ${t._count.users} usuarios · ${t._count.packages} paquetes`,
    );
  }
  console.log("\nPara ver qué se borraría:");
  console.log(
    `  pnpm tsx scripts/delete-tenant.ts ${tenants.map((t) => `--slug ${t.slug}`).join(" ")}\n`,
  );
}

async function describe(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.error(`✖ No existe ningún edificio con slug "${slug}".`);
    return null;
  }

  const [units, users, packages, notifications, audits, withPhoto] = await Promise.all([
    prisma.unit.count({ where: { tenantId: tenant.id } }),
    prisma.user.count({ where: { tenantId: tenant.id } }),
    prisma.package.count({ where: { tenantId: tenant.id } }),
    prisma.notification.count({ where: { package: { tenantId: tenant.id } } }),
    prisma.auditLog.count({ where: { tenantId: tenant.id } }),
    prisma.package.count({
      where: {
        tenantId: tenant.id,
        OR: [{ photoUrl: { not: null } }, { pickupPhotoUrl: { not: null } }],
      },
    }),
  ]);

  console.log(`\n  ${slug} — ${tenant.name}`);
  console.log(`    ${packages} paquetes (${withPhoto} con foto)`);
  console.log(`    ${notifications} notificaciones`);
  console.log(`    ${units} unidades`);
  console.log(`    ${users} usuarios (admins, guardias y residentes)`);
  console.log(`    ${audits} entradas de auditoría`);

  return { ...tenant, packages, users };
}

async function deleteTenant(id: string, slug: string) {
  const storage = getStorageClient();

  // 1. Las fotos primero. No las alcanza ningún cascade: viven en el bucket, y
  //    una vez borradas las filas no queda de dónde sacar sus URLs.
  if (storage.isConfigured) {
    const objects = await storage.list(`packages/${id}/`);
    let deleted = 0;
    for (const obj of objects) {
      try {
        await storage.remove(obj.url);
        deleted++;
      } catch (err) {
        console.error(
          `    ✖ no se pudo borrar ${obj.key}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    console.log(`    ${deleted}/${objects.length} archivos borrados del bucket`);
  } else {
    console.log("    (storage no configurado — no hay archivos que borrar)");
  }

  // 2. La base, en orden de dependencia. Borrar el Tenant a secas dispara
  //    cascades hacia User, Unit y Package a la vez, y Package.receivedByUserId
  //    es RESTRICT: según el orden en que Postgres los procese, puede fallar
  //    con violación de FK. Yendo de la hoja a la raíz eso no puede pasar.
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { package: { tenantId: id } } });
    await tx.package.deleteMany({ where: { tenantId: id } });
    await tx.unitResident.deleteMany({ where: { unit: { tenantId: id } } });
    await tx.unit.deleteMany({ where: { tenantId: id } });
    // Los audit logs quedarían con tenantId=null (SetNull) y sin nada que los
    // explique: se van con el edificio.
    await tx.auditLog.deleteMany({ where: { tenantId: id } });
    // Sesiones y cuentas de Auth.js cascadean desde User.
    await tx.user.deleteMany({ where: { tenantId: id } });
    await tx.tenant.delete({ where: { id } });
  });

  console.log(`    ✔ ${slug} borrado`);
}

async function main() {
  const { slugs, confirm } = parseArgs(process.argv.slice(2));

  if (slugs.length === 0) {
    await listTenants();
    return;
  }

  console.log(confirm ? "\n⚠️  BORRADO REAL\n" : "\nSimulación — no se borra nada todavía.");

  const targets = [];
  for (const slug of slugs) {
    const t = await describe(slug);
    if (t) targets.push({ ...t, slug });
  }
  if (targets.length === 0) {
    console.error("\nNada que borrar.\n");
    process.exit(1);
  }

  if (!confirm) {
    console.log("\nSi es exactamente esto, repetí el comando agregando --confirm:");
    console.log(
      `  pnpm tsx scripts/delete-tenant.ts ${targets.map((t) => `--slug ${t.slug}`).join(" ")} --confirm\n`,
    );
    return;
  }

  console.log("");
  for (const t of targets) {
    console.log(`  Borrando ${t.slug}…`);
    await deleteTenant(t.id, t.slug);
  }
  console.log("\nListo.\n");
}

main()
  .catch((err) => {
    console.error("\n✖", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
