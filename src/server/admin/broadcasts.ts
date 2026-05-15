"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendBroadcast } from "@/server/broadcasts/send";

const Input = z.object({
  subject: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(900),
});

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  return tenant.id;
}

export async function sendBroadcastAction(slug: string, formData: FormData) {
  const tenantId = await resolveTenant(slug);
  const parsed = Input.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    redirect(
      `/${slug}/admin/avisos/nuevo?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Datos inválidos")}`,
    );
  }
  let sent = 0;
  let failed = 0;
  try {
    const result = await sendBroadcast({
      tenantId,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    sent = result.sent;
    failed = result.failed;
  } catch (err) {
    redirect(
      `/${slug}/admin/avisos/nuevo?error=${encodeURIComponent(err instanceof Error ? err.message : "ERROR")}`,
    );
  }
  redirect(`/${slug}/admin/avisos?ok=${sent}-enviados${failed ? `-${failed}-fallidos` : ""}`);
}
