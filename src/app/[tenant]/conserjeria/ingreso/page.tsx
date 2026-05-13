import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { registerPackage } from "@/server/packages/register";
import { requireTenantRoleOrRedirect } from "@/lib/auth";

export default async function IngresoPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
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
    if (typeof unitId !== "string") throw new Error("unitId requerido");
    const carrier = formData.get("carrier");
    const notes = formData.get("notes");

    const result = await registerPackage({
      tenantId: tenant!.id,
      unitId,
      carrier: typeof carrier === "string" && carrier ? carrier : undefined,
      notes: typeof notes === "string" && notes ? notes : undefined,
    });
    redirect(`/${slug}/conserjeria?codigo=${result.pickupCode}`);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-6">
        <p className="text-sm text-slate-500">{tenant.name}</p>
        <h1 className="text-2xl font-bold">Registrar paquete</h1>
      </header>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Departamento</span>
          <select name="unitId" required className="rounded border border-slate-300 px-3 py-2">
            <option value="">Elegí un departamento…</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Transportista (opcional)</span>
          <input
            name="carrier"
            placeholder="Mercado Libre, Andreani, OCA…"
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notas (opcional)</span>
          <textarea
            name="notes"
            rows={3}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-3 font-semibold text-brand-fg"
        >
          Registrar y notificar
        </button>
      </form>
    </main>
  );
}
