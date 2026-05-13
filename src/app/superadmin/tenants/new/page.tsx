import Link from "next/link";
import { createTenantAction } from "@/server/superadmin/tenants";

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link
          href="/superadmin"
          aria-label="Volver"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 text-ink-300 hover:text-ink-100"
        >
          ←
        </Link>
        <div>
          <h2 className="text-xl font-bold">Nuevo edificio</h2>
          <p className="text-xs text-ink-400">Esto crea el tenant y deja un admin con magic link</p>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <form action={createTenantAction} className="flex flex-col gap-4 rounded-2xl border border-ink-700 bg-ink-850 p-5">
        <Section title="Edificio">
          <Field label="Slug (la URL)" hint="solo a-z, 0-9, guión — ej. edificio-libertad">
            <input
              name="slug"
              required
              maxLength={40}
              placeholder="edificio-libertad"
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </Field>
          <Field label="Nombre" hint="visible para los residentes en el WhatsApp">
            <input
              name="name"
              required
              maxLength={120}
              placeholder="Edificio Libertad"
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </Field>
        </Section>

        <Section title="Admin inicial">
          <Field label="Nombre">
            <input
              name="adminName"
              required
              maxLength={80}
              placeholder="Administración Edificio Libertad"
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </Field>
          <Field label="Email" hint="acá llega el magic link de acceso">
            <input
              name="adminEmail"
              type="email"
              required
              placeholder="admin@edificio.com"
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </Field>
        </Section>

        <button
          type="submit"
          className="mt-2 rounded-2xl bg-accent px-4 py-3 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Crear edificio
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-ink-800 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink-200">{label}</span>
      {hint && <span className="text-xs text-ink-500">{hint}</span>}
      {children}
    </label>
  );
}
