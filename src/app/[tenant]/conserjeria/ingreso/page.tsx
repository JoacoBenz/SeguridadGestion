import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { registerPackage } from "@/server/packages/register";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { UnitTilePicker } from "@/components/conserjeria/unit-tile-picker";

export default async function IngresoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error } = await searchParams;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  await requireTenantRoleOrRedirect(
    tenant.id,
    ["guard", "admin"],
    `/${slug}/conserjeria/ingreso`,
  );

  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    orderBy: { label: "asc" },
    select: { id: true, label: true },
  });

  async function action(formData: FormData) {
    "use server";
    const unitId = formData.get("unitId");
    if (typeof unitId !== "string" || !unitId) {
      redirect(`/${slug}/conserjeria/ingreso?error=Elegí+un+departamento`);
    }
    const carrier = formData.get("carrier");
    const notes = formData.get("notes");

    // El redirect de éxito va FUERA del try: redirect() tira NEXT_REDIRECT
    // y un catch-all lo convertiría en ?error=.
    let pickupCode: string;
    try {
      const result = await registerPackage({
        tenantId: tenant!.id,
        unitId,
        carrier: typeof carrier === "string" && carrier ? carrier : undefined,
        notes: typeof notes === "string" && notes ? notes : undefined,
      });
      pickupCode = result.pickupCode;
    } catch {
      redirect(
        `/${slug}/conserjeria/ingreso?error=${encodeURIComponent(
          "No se pudo registrar el paquete. Probá de nuevo.",
        )}`,
      );
    }
    redirect(`/${slug}/conserjeria?codigo=${pickupCode}`);
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-6">
      <PageHeader slug={slug} tenantName={tenant.name} />

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical"
        >
          {error}
        </p>
      )}

      <form action={action} className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
            Para qué departamento
          </h2>
          <UnitTilePicker name="unitId" units={units} />
        </section>

        <section>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-ink-400">
              Transportista <span className="font-normal normal-case text-ink-500">(opcional)</span>
            </span>
            <input
              name="carrier"
              placeholder="Andreani, OCA, Mercado Libre…"
              className="w-full rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </label>
        </section>

        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-200 [&::-webkit-details-marker]:hidden">
            <span className="text-lg leading-none transition-transform group-open:rotate-45" aria-hidden>＋</span>
            más detalles
          </summary>
          <label className="mt-3 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-ink-400">
              Notas
            </span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Encomienda grande, viene del veterinario…"
              className="w-full resize-none rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </label>
        </details>

        <button
          type="submit"
          className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Registrar y notificar
        </button>
      </form>
    </main>
  );
}

function PageHeader({ slug, tenantName }: { slug: string; tenantName: string }) {
  return (
    <header className="mb-8 flex items-center gap-3">
      <Link
        href={`/${slug}/conserjeria`}
        aria-label="Volver"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 text-ink-300 transition-colors hover:text-ink-100"
      >
        ←
      </Link>
      <div>
        <p className="text-xs text-ink-400">{tenantName}</p>
        <h1 className="text-xl font-bold">Nuevo paquete</h1>
      </div>
    </header>
  );
}
