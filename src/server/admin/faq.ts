"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

const CreateInput = z.object({
  question: z.string().trim().min(3).max(280),
  answer: z.string().trim().min(3).max(2000),
});

export async function createFaqAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);
  const parsed = CreateInput.safeParse({
    question: formData.get("question"),
    answer: formData.get("answer"),
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/reglamento?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Datos inválidos")}`,
    );
  }
  const max = await prisma.faqEntry.aggregate({
    where: { tenantId },
    _max: { ordinal: true },
  });
  const ordinal = (max._max.ordinal ?? 0) + 1;
  const entry = await prisma.faqEntry.create({
    data: {
      tenantId,
      ordinal,
      question: parsed.data.question,
      answer: parsed.data.answer,
    },
  });
  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "faq.created",
    entityType: "FaqEntry",
    entityId: entry.id,
    metadata: { question: entry.question },
  });
  redirect(`/${slug}/admin/reglamento?ok=creada`);
}

export async function deleteFaqAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const session = await requireTenantRole(tenantId, ["admin"]);
  const id = formData.get("faqId");
  if (typeof id !== "string" || !id) {
    redirect(`/${slug}/admin/reglamento?error=${encodeURIComponent("Falta id")}`);
  }
  const entry = await prisma.faqEntry.findFirst({ where: { id, tenantId } });
  if (!entry) redirect(`/${slug}/admin/reglamento?error=${encodeURIComponent("No encontrada")}`);
  await prisma.faqEntry.delete({ where: { id: entry!.id } });
  await recordAudit({
    tenantId,
    actorUserId: session.userId,
    action: "faq.deleted",
    entityType: "FaqEntry",
    entityId: entry!.id,
  });
  redirect(`/${slug}/admin/reglamento?ok=borrada`);
}
