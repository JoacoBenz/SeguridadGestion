import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { importResidentsAction } from "@/server/admin/residents";
import { parseResidentsCsv } from "@/server/admin/import-parse";

const EXAMPLE = `unidad,nombre,telefono,email
3B,Juan Pérez,+5491133334444,juan@email.com
3B,Ana Pérez,+5491155556666,
5A,Carla Gómez,+5491177778888,carla@email.com`;

export default async function ImportarPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ csv?: string; error?: string }>;
}) {
  const { tenant: slug } = await params;
  const { csv, error } = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  // Las pages no pueden delegar el auth al layout (renderizan en paralelo).
  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin/importar`);

  const preview = csv ? parseResidentsCsv(csv) : null;
  const doImport = importResidentsAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-bold">Importar residentes</h2>
        <p className="mt-1 text-sm text-ink-400">
          Pegá una tabla <span className="font-mono text-xs">unidad, nombre, teléfono, email</span>{" "}
          (email opcional). Las unidades que no existan se crean solas.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      {/* Paso 1: pegar y previsualizar (GET, re-parsea sin escribir nada). */}
      <form method="get" className="flex flex-col gap-3">
        <textarea
          name="csv"
          rows={8}
          defaultValue={csv ?? ""}
          placeholder={EXAMPLE}
          className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-sm text-ink-100 placeholder:text-ink-600 focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-100 hover:border-ink-500"
          >
            Previsualizar
          </button>
        </div>
      </form>

      {preview && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-md border border-positive/40 bg-positive/10 px-2 py-1 text-positive">
              {preview.validCount} ok
            </span>
            {preview.errorCount > 0 && (
              <span className="rounded-md border border-critical/40 bg-critical/10 px-2 py-1 text-critical">
                {preview.errorCount} con error
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-ink-700 bg-ink-850">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-800 text-left text-xs uppercase tracking-widest text-ink-400">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Unidad</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Teléfono</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.error ? "bg-critical/5" : ""}>
                    <td className="px-4 py-2 font-mono text-ink-500">{r.line}</td>
                    <td className="px-4 py-2 font-mono">{r.unit}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 font-mono text-ink-300">{r.phone || "—"}</td>
                    <td className="px-4 py-2 text-ink-400">{r.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      {r.error ? (
                        <span className="text-xs text-critical">{r.error}</span>
                      ) : (
                        <span className="text-xs text-positive">✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paso 2: confirmar (POST a la action). Solo si no hay errores. */}
          {preview.errorCount === 0 ? (
            <form action={doImport}>
              <input type="hidden" name="csv" value={csv} />
              <button
                type="submit"
                className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
              >
                Confirmar importación de {preview.validCount} residente
                {preview.validCount === 1 ? "" : "s"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-ink-400">
              Corregí las filas con error arriba y volvé a previsualizar. No se importa nada hasta
              que estén todas ok.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
