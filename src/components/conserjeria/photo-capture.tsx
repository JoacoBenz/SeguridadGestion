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

  // setCustomValidity persiste en el elemento: hay que limpiarlo cuando la
  // foto ya subió, o el form quedaría bloqueado aunque el campo sea válido.
  useEffect(() => {
    urlInputRef.current?.setCustomValidity("");
  }, [url]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      setUrl(json.url);
      setState("idle");
    } catch {
      setState("error");
      setUrl(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
        {label}{" "}
        <span className="font-normal normal-case text-ink-500">
          {required ? "(obligatoria)" : "(opcional)"}
        </span>
      </span>
      <input
        ref={urlInputRef}
        type="text"
        name={name}
        value={url ?? ""}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onInvalid={(e) =>
          (e.target as HTMLInputElement).setCustomValidity("Sacale una foto al paquete antes de registrar")
        }
        onChange={() => undefined}
      />
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-850 px-4 py-3 text-ink-300 transition-colors hover:border-ink-500">
        <input
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
                ? "Foto lista ✓ — tocá para cambiar"
                : "Sacar o elegir foto"}
        </span>
      </label>
    </div>
  );
}
