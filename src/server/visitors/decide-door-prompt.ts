import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

const Input = z.object({
  visitorEventId: z.string().min(1),
  decidedByUserId: z.string().min(1),
  decision: z.enum(["confirmed", "rejected"]),
});

export type DecideDoorPromptInput = z.infer<typeof Input>;

// Called from the chat dispatcher when a resident answers a door prompt.
// First-write-wins: if already decided, this is a no-op.
export async function decideDoorPrompt(raw: DecideDoorPromptInput) {
  const input = Input.parse(raw);
  const event = await prisma.visitorEvent.findUnique({
    where: { id: input.visitorEventId },
  });
  if (!event) return null;
  if (event.kind !== "door_prompt") return null;
  if (event.status !== "pending") return event;

  const updated = await prisma.visitorEvent.update({
    where: { id: input.visitorEventId },
    data: {
      status: input.decision,
      decidedByUserId: input.decidedByUserId,
      decidedAt: new Date(),
    },
  });
  await recordAudit({
    tenantId: event.tenantId,
    actorUserId: input.decidedByUserId,
    action: `door.${input.decision}`,
    entityType: "VisitorEvent",
    entityId: event.id,
  });
  return updated;
}
