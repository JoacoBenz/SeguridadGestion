import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runCron } from "@/server/cron/run";

// runCron es la única puerta de los crons: auth + heartbeat. Lo que se fija
// acá contra el Postgres real: que cada corrida (ok o rota) deje su AuditLog
// GLOBAL, y que el 401 no ejecute nada.

const JOB = `test-job-${Date.now().toString().slice(-7)}`;
const SECRET = "test-cron-secret";
let prevSecret: string | undefined;

beforeAll(() => {
  prevSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
});

afterAll(async () => {
  if (prevSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = prevSecret;
  await prisma.auditLog.deleteMany({ where: { entityType: "Cron", entityId: JOB } });
  await prisma.$disconnect();
});

function reqWithAuth(token: string | null): Request {
  return new Request("http://localhost/api/cron/test", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("runCron", () => {
  it("sin Bearer válido: 401 y el handler NO corre", async () => {
    let ran = false;
    const res = await runCron(JOB, reqWithAuth("incorrecto"), async () => {
      ran = true;
      return {};
    });
    expect(res.status).toBe(401);
    expect(ran).toBe(false);
  });

  it("corrida ok: 200 y queda el heartbeat global cron.ok", async () => {
    const res = await runCron(JOB, reqWithAuth(SECRET), async () => ({ procesados: 7 }));
    expect(res.status).toBe(200);

    const beat = await prisma.auditLog.findFirst({
      where: { entityType: "Cron", entityId: JOB },
      orderBy: { at: "desc" },
    });
    expect(beat?.action).toBe("cron.ok");
    expect(beat?.tenantId).toBeNull();
    expect((beat?.metadata as { procesados?: number })?.procesados).toBe(7);
  });

  it("handler que explota: 500 y queda el heartbeat cron.failed con el mensaje", async () => {
    const res = await runCron(JOB, reqWithAuth(SECRET), async () => {
      throw new Error("se rompió todo");
    });
    expect(res.status).toBe(500);

    const beat = await prisma.auditLog.findFirst({
      where: { entityType: "Cron", entityId: JOB },
      orderBy: { at: "desc" },
    });
    expect(beat?.action).toBe("cron.failed");
    expect((beat?.metadata as { message?: string })?.message).toBe("se rompió todo");
  });
});
