import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { sendBroadcastAction } from "@/server/admin/broadcasts";

export default async function NuevoAvisoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error } = await searchParams;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const residentCount = await prisma.user.count({
    where: { tenantId: tenant.id, role: "resident", phone: { not: null } },
  });

  const send = sendBroadcastAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Nuevo aviso</h2>
        <p className="text-xs text-ink-400">
          Se enviará a {residentCount} residente{residentCount === 1 ? "" : "s"} con WhatsApp
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <form
        action={send}
        className="flex flex-col gap-4 rounded-2xl border border-ink-700 bg-ink-850 p-5"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Asunto (interno)
          </span>
          <input
            name="subject"
            required
            maxLength={140}
            placeholder="Corte de agua programado"
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Mensaje
          </span>
          <textarea
            name="body"
            required
            maxLength={900}
            rows={6}
            placeholder="Mañana de 09 a 12 hs habrá corte programado de agua…"
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </label>
        <p className="text-xs text-ink-500">
          Se envía como plantilla <code>aviso_general_v1</code>. Máximo 900 caracteres.
        </p>
        <button
          type="submit"
          className="self-end rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Enviar a todos
        </button>
      </form>
    </div>
  );
}
