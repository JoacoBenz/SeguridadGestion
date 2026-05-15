"use client";

import { useState } from "react";

interface Props {
  slug: string;
  units: { id: string; label: string }[];
  action: (formData: FormData) => Promise<void>;
}

export function IncidentQuickForm({ units, action }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-warn/40 bg-warn/10 py-4 font-semibold text-warn transition-colors hover:border-warn"
      >
        <span className="text-lg" aria-hidden>!</span>
        Incidente
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <form
            action={action}
            className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl border border-ink-700 bg-ink-850 p-6 sm:rounded-3xl"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-bold">Registrar incidente</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-ink-400 hover:text-ink-200"
              >
                Cerrar
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-400">Tipo</span>
              <select
                name="kind"
                required
                defaultValue="incident"
                className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
              >
                <option value="incident">Incidente</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="noise">Ruido</option>
                <option value="suspicious">Persona sospechosa</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-400">Unidad (opcional)</span>
              <select
                name="unitId"
                className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
              >
                <option value="">— sin unidad —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-400">Qué pasó</span>
              <textarea
                name="body"
                required
                rows={4}
                maxLength={2000}
                placeholder="Persona intentando ingresar sin autorización…"
                className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-warn px-4 py-3 font-semibold text-ink-900"
            >
              Registrar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
