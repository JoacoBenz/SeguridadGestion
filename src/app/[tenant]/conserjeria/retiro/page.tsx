import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { pickupPackage } from "@/server/packages/pickup";

export default async function RetiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error, ok } = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  async function action(formData: FormData) {
    "use server";
    const codeRaw = formData.get("pickupCode");
    if (typeof codeRaw !== "string" || !codeRaw.trim()) {
      redirect(`/${slug}/conserjeria/retiro?error=Ingres%C3%A1+un+c%C3%B3digo`);
    }
    const code = codeRaw.trim().toUpperCase();
    try {
      const result = await pickupPackage({
        tenantId: tenant!.id,
        pickupCode: code,
      });
      redirect(`/${slug}/conserjeria/retiro?ok=Depto+${result.unitLabel}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ERROR";
      redirect(`/${slug}/conserjeria/retiro?error=${encodeURIComponent(msg)}`);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">{tenant.name}</p>
        <h1 className="text-2xl font-bold">Procesar retiro</h1>
      </header>

      {ok && (
        <p className="mb-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
          Retirado: {ok}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900">
          {error}
        </p>
      )}

      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Código de retiro (6 caracteres)</span>
          <input
            name="pickupCode"
            autoFocus
            required
            inputMode="text"
            autoCapitalize="characters"
            className="rounded border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-widest"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-3 font-semibold text-brand-fg"
        >
          Confirmar retiro
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        Para escaneo de QR con la cámara, usá el botón en pantalla principal (próximamente).
      </p>
    </main>
  );
}
