import { notFound } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";
import {
  changeMemberRoleAction,
  createMemberAction,
  removeMemberAction,
} from "@/server/admin/team";

export default async function EquipoPage({
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
    select: { id: true },
  });
  if (!tenant) notFound();

  const session = await requireTenantRoleOrRedirect(
    tenant.id,
    ["admin"],
    `/${slug}/admin/equipo`,
  );

  const members = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      role: { in: ["admin", "guard"] },
      // Excluye el guard sintético del dispositivo-PIN: no es una persona, se
      // gestiona desde "PIN de seguridad" en el panel, no acá.
      NOT: { email: { endsWith: "@paqueteok.device" } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });

  const create = createMemberAction.bind(null, slug);
  const changeRole = changeMemberRoleAction.bind(null, slug);
  const remove = removeMemberAction.bind(null, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Equipo</h2>
        <p className="text-xs text-ink-400">{members.length} con acceso</p>
      </header>

      <p className="text-sm text-ink-400">
        Administradores y guardias que entran con su email (magic link). Los guardias también
        pueden usar el{" "}
        <span className="text-ink-200">PIN de seguridad</span> en la tablet del mostrador.
      </p>

      {ok && (
        <div className="rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          {ok}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <form
        action={create}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:grid-cols-2"
      >
        <Field label="Nombre">
          <input
            name="name"
            required
            placeholder="Nombre y apellido"
            maxLength={80}
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            placeholder="persona@email.com"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </Field>
        <Field label="Rol">
          <select
            name="role"
            required
            defaultValue="guard"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
          >
            <option value="guard">Guardia — solo seguridad</option>
            <option value="admin">Administrador — panel completo</option>
          </select>
        </Field>
        <div className="flex items-end">
          <SubmitButton
            pendingText="Agregando…"
            className="w-full rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
          >
            Agregar al equipo
          </SubmitButton>
        </div>
      </form>

      <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 divide-y divide-ink-800">
        {members.map((m) => {
          const isSelf = m.id === session.userId;
          return (
            <li
              key={m.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink-100">{m.name}</p>
                  <RoleTag role={m.role} />
                  {isSelf && (
                    <span className="rounded-md border border-ink-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-500">
                      vos
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-ink-400">{m.email}</p>
              </div>

              {isSelf ? (
                <span className="text-xs text-ink-500">Tu propia cuenta</span>
              ) : (
                <div className="flex items-center gap-2">
                  <form action={changeRole}>
                    <input type="hidden" name="userId" value={m.id} />
                    <input type="hidden" name="role" value={m.role === "admin" ? "guard" : "admin"} />
                    <button
                      type="submit"
                      className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      {m.role === "admin" ? "Hacer guardia" : "Hacer admin"}
                    </button>
                  </form>
                  <form action={remove}>
                    <input type="hidden" name="userId" value={m.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition-colors hover:border-critical/60 hover:text-critical"
                    >
                      Quitar
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoleTag({ role }: { role: Role }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={
        isAdmin
          ? "rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
          : "rounded-md border border-ink-700 bg-ink-800 px-2 py-0.5 text-xs font-medium text-ink-300"
      }
    >
      {isAdmin ? "Admin" : "Guardia"}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}
