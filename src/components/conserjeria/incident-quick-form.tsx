"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  slug: string;
  action: (formData: FormData) => Promise<void>;
}

// The conserjería floating-actions bar uses backdrop-blur, which makes its
// children's containing block the bar itself instead of the viewport. To make
// the modal cover the screen, render it via a portal to document.body.
export function IncidentQuickForm({ action }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const modal = open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <form
        action={action}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-3xl border border-ink-700 bg-ink-850 p-6"
      >
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold">Registrar incidente</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-ink-700 px-2 py-1 text-xs text-ink-400 hover:border-ink-500 hover:text-ink-200"
          >
            Cerrar
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Tipo
          </span>
          <select
            name="kind"
            required
            defaultValue="incident"
            className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-ink-100 focus:border-accent focus:outline-none"
          >
            <option value="incident">Incidente general</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="noise">Ruido / disturbio</option>
            <option value="suspicious">Persona sospechosa</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Qué pasó
          </span>
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
          className="mt-2 rounded-xl bg-warn px-4 py-3 font-semibold text-ink-900 transition-transform active:scale-[0.98]"
        >
          Registrar
        </button>
      </form>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-warn/40 bg-ink-800 py-4 font-semibold text-warn transition-colors hover:border-warn"
      >
        <span className="text-lg leading-none" aria-hidden>⚠</span>
        Incidente
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
