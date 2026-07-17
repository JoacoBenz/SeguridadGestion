"use client";

import { useState } from "react";

// Captura opcional de foto. Usa la cámara nativa del celular (input capture),
// sube al /api/upload y deja la URL en un hidden field con el name que se pase.
// Si el storage no está configurado (dev), el padre no debería renderizar esto.
export function PhotoCapture({ slug, name, label }: { slug: string; name: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");

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
        {label} <span className="font-normal normal-case text-ink-500">(opcional)</span>
      </span>
      {url && <input type="hidden" name={name} value={url} />}
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
