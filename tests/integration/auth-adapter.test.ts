import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

// El adapter de Auth.js contra Postgres real. Lo que se fija acá es que una
// cookie que apunta a una sesión que ya no existe NO rompa el login: el
// PrismaAdapter de fábrica usa `delete()`, que tira P2025, y Auth.js lo
// convierte en "Configuration" — el usuario queda afuera sin más salida que
// borrar las cookies a mano.

const prisma = new PrismaClient();

let userId: string;

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  userId = (
    await prisma.user.create({
      data: { email: `adapter-${suffix}@test.local`, name: "Probe", role: "resident" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("borrar una sesión inexistente", () => {
  it("delete() explota — es el bug que dejaba a un usuario afuera", async () => {
    await expect(
      prisma.session.delete({ where: { sessionToken: "token-que-no-existe" } }),
    ).rejects.toThrow();
  });

  it("deleteMany() no explota — es lo que usa nuestro adapter", async () => {
    const r = await prisma.session.deleteMany({
      where: { sessionToken: "token-que-no-existe" },
    });
    expect(r.count).toBe(0);
  });

  it("y sigue borrando de verdad cuando la sesión existe", async () => {
    await prisma.session.create({
      data: {
        sessionToken: `probe-${Math.random()}`,
        userId,
        expires: new Date(Date.now() + 60_000),
      },
    });
    const token = (await prisma.session.findFirstOrThrow({ where: { userId } }))
      .sessionToken;

    const r = await prisma.session.deleteMany({ where: { sessionToken: token } });
    expect(r.count).toBe(1);
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
  });
});

describe("User.name", () => {
  it("se puede crear un usuario sin nombre, como hace el magic link", async () => {
    // Auth.js llama createUser con { id, email, emailVerified } y nada más.
    const email = `sinnombre-${Math.random().toString(36).slice(2, 8)}@test.local`;
    const created = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
      `INSERT INTO "User" (id, email, "emailVerified", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, now(), now())
       RETURNING id, name`,
      email,
    );
    expect(created[0]!.name).toBe("");
    await prisma.user.delete({ where: { id: created[0]!.id } });
  });
});
