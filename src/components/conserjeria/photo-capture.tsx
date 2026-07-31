"use client";

import { useEffect, useRef, useState } from "react";

// Captura de foto. Usa la cámara nativa del celular (input capture), sube al
// /api/upload y deja la URL en un field con el name que se pase. Con
// `required`, el form no puede enviarse hasta que la subida termine (el input
// de la URL es de texto visualmente oculto — los hidden no participan de la
// validación del navegador). Si el storage no está configurado (dev), el
// padre no debería renderizar esto.
export function PhotoCapture({
  slug,
  name,
  label,
  required = false,
}: {
  slug: string;
  name: string;
  label: string;
  required?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Si el guardia saca otra foto mientras la anterior todavía sube, las
  // respuestas pueden llegar al revés y dejar pegada la URL de la foto vieja.
  // Sólo la subida más reciente tiene derecho a escribir el estado.
  const uploadSeq = useRef(0);

  // setCustomValidity persiste en el elemento: hay que limpiarlo cuando la
  // foto ya subió, o el form quedaría bloqueado aunque el campo sea válido.
  useEffect(() => {
    urlInputRef.current?.setCustomValidity("");
  }, [url]);

  // Descarta del bucket una foto que se reemplazó o se borró. Best-effort: si
  // falla, el barrido de huérfanos la levanta igual más adelante.
  function discard(target: string) {
    void fetch(
      `/api/upload?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(target)}`,
      { method: "DELETE", keepalive: true },
    ).catch(() => undefined);
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const seq = ++uploadSeq.current;
    const replaced = url;

    setPreview(URL.createObjectURL(file));
    setState("uploading");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/upload?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { url: string };
      if (seq !== uploadSeq.current) {
        // Quedó vieja: la nueva ya está en curso, así que esta no sirve.
        discard(json.url);
        return;
      }
      setUrl(json.url);
      setState("idle");
      // La que se reemplaza se borra recién ahora: si el borrado saliera antes
      // y la nueva subida fallara, el guardia se quedaría sin ninguna.
      if (replaced) discard(replaced);
    } catch {
      if (seq !== uploadSeq.current) return;
      setState("error");
      setUrl(null);
    }
  }

  function removePhoto() {
    uploadSeq.current++;
    if (url) discard(url);
    setUrl(null);
    setPreview(null);
    setState("idle");
    // Sin esto, volver a elegir el mismo archivo no dispara change.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
        {label}{" "}
        <span className="font-normal normal-case text-ink-500">
          {required ? "(obligatoria)" : "(opcional)"}
        </span>
      </span>
      {/* Invisible pero EN FLUJO, enfocable y SIN readonly: los inputs readonly
          están excluidos de la validación HTML (required se ignora), y los
          no-enfocables (sr-only) hacen que Chrome deje pasar el submit. Con
          1px + opacity-0, controlado por React, el globo de validación aparece
          y el form no se envía hasta que la subida deja la URL. */}
      <input
        ref={urlInputRef}
        type="text"
        name={name}
        value={url ?? ""}
        required={required}
        aria-hidden
        autoComplete="off"
        className="h-px w-px self-start opacity-0"
        onInvalid={(e) =>
          (e.target as HTMLInputElement).setCustomValidity("Sacale una foto al paquete antes de registrar")
        }
        onChange={() => undefined}
      />
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-850 px-4 py-3 text-ink-300 transition-colors hover:border-ink-500">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onChange}
          className="hidden"
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Foto del paquete" className="h-14 w-14 rounded-lg object-cover" />
        ) : (
          <span className="text-2xl" aria-hidden>📷</span>
        )}
        <span className="text-sm">
          {state === "uploading"
            ? "Subiendo…"
            : state === "error"
              ? "Error al subir — tocá para reintentar"
              : url
                ? "Foto lista ✓"
                : "Sacar o elegir foto"}
        </span>
      </label>

      {/* Botones explícitos: "salió movida, saco otra" es el caso común en el
          mostrador y no puede depender de descubrir que la tarjeta es tocable. */}
      {(url || state === "error") && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-ink-500"
          >
            📷 Sacar de nuevo
          </button>
          {url && (
            <button
              type="button"
              onClick={removePhoto}
              className="rounded-xl border border-ink-700 px-4 py-2 text-sm text-ink-400 transition-colors hover:border-critical/60 hover:text-critical"
            >
              Quitar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
