import { prisma } from "@/lib/db";

// Once a resident's vacationEnd has passed (i.e. < start of today), clear
// vacationStart and vacationEnd so the resident is no longer flagged "on
// vacation" anywhere in the UI or the bot. Called lazily on page loads —
// idempotent and cheap (updateMany affects 0 rows most of the time).
export async function clearExpiredVacationsForTenant(tenantId: string): Promise<void> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  await prisma.user.updateMany({
    where: {
      tenantId,
      vacationEnd: { lt: startOfToday },
    },
    data: { vacationStart: null, vacationEnd: null },
  });
}
