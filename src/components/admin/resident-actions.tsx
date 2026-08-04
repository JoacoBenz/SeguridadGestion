"use client";

import { useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";

// Editar y borrar un residente desde un modal.
//
// La versión anterior expandía el formulario dentro de la fila: en un celular
// eso empujaba la lista y hacía perder de vista a quién se estaba editando. Un
// <dialog> nativo se centra sobre todo lo demás, atrapa el foco, cierra con Esc
// y con el fondo — y deja la tarjeta de la lista chica, que es lo que importa
// cuando hay cientos de residentes.

export interface ResidentForActions {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export function ResidentActions({
  resident,
  units,
  linkedUnitIds,
  updateAction,
  deleteAction,
}: {
  resident: ResidentForActions;
  units: Array<{ id: string; label: string }>;
  linkedUnitIds: string[];
  updateAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
}) {
  const editRef = useRef<HTMLDialogElement | null>(null);
  const deleteRef = useRef<HTMLDialogElement | null>(null);
  const linkable = units.filter((u) => !linkedUnitIds.includes(u.id));

  return (
    <>
      <div className="flex shrink-0 gap-1">
        <IconButton label="Editar" onClick={() => editRef.current?.showModal()}>
          ✎
        </IconButton>
        <IconButton
          label="Borrar"
          danger
          onClick={() => deleteRef.current?.showModal()}
        >
          🗑
        </IconButton>
      </div>

      <Modal ref={editRef} title={`Editar ${resident.name}`}>
        <form action={updateAction} className="flex flex-col gap-3">
          <input type="hidden" name="userId" value={resident.id} />
          <Field label="Nombre">
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={resident.name}
              className={INPUT}
            />
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <input
              name="phone"
              required
              type="tel"
              defaultValue={resident.phone ?? ""}
              className={`${INPUT} font-mono`}
            />
          </Field>
          <Field label="Email (vacío lo borra)">
            <input
              name="email"
              type="email"
              defaultValue={resident.email ?? ""}
              className={INPUT}
            />
          </Field>
          {linkable.length > 0 && (
            <Field label="Vincular a otro depto (opcional)">
              <select name="unitId" defaultValue="" className={INPUT}>
                <option value="">No cambiar</option>
                {linkable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => editRef.current?.close()}
              className="flex-1 rounded-xl border border-ink-700 px-4 py-3 text-sm text-ink-300 transition-colors hover:text-ink-100"
            >
              Cancelar
            </button>
            <SubmitButton
              pendingText="Guardando…"
              className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
      </Modal>

      <Modal ref={deleteRef} title="¿Borrar residente?">
        <p className="text-sm text-ink-300">
          Se va a borrar <strong className="text-ink-100">{resident.name}</strong> y dejará
          de recibir avisos. No se puede deshacer.
        </p>
        <p className="mt-2 text-xs text-ink-500">
          Si tiene paquetes en el historial no se va a poder borrar: usá
          &ldquo;Desvincular&rdquo; en el chip del depto para sacarlo de la unidad sin perder
          ese historial.
        </p>
        <form action={deleteAction} className="mt-4 flex gap-2">
          <input type="hidden" name="userId" value={resident.id} />
          <button
            type="button"
            onClick={() => deleteRef.current?.close()}
            className="flex-1 rounded-xl border border-ink-700 px-4 py-3 text-sm text-ink-300 transition-colors hover:text-ink-100"
          >
            Cancelar
          </button>
          <SubmitButton
            pendingText="Borrando…"
            className="flex-1 rounded-xl bg-critical px-4 py-3 text-sm font-semibold text-white"
          >
            Sí, borrar
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}

const INPUT =
  "w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 text-ink-100 focus:border-accent focus:outline-none";

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

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        danger
          ? "flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 text-sm text-ink-400 transition-colors hover:border-critical/60 hover:text-critical"
          : "flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 text-sm text-ink-300 transition-colors hover:border-accent/60 hover:text-accent"
      }
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

function Modal({
  ref,
  title,
  children,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  title: string;
  children: React.ReactNode;
}) {
  // Click en el fondo cierra. `showModal()` centra el diálogo y bloquea el
  // scroll de atrás solo; el click se detecta porque el target es el <dialog>
  // y no su contenido.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === el) el.close();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [ref]);

  return (
    <dialog
      ref={ref}
      className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-ink-700 bg-ink-850 p-0 text-ink-100 backdrop:bg-black/70 open:animate-none"
    >
      <div className="p-5">
        <h3 className="mb-4 text-base font-bold text-ink-100">{title}</h3>
        {children}
      </div>
    </dialog>
  );
}
