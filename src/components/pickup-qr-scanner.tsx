"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { pickupByTokenAction } from "@/server/packages/pickup-actions";

interface Props {
  tenantSlug: string;
}

export function PickupQrScanner({ tenantSlug }: Props) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, startTransition] = useTransition();
  const [lastHandled, setLastHandled] = useState<string | null>(null);

  function handleDetect(codes: IDetectedBarcode[]) {
    const first = codes[0]?.rawValue;
    if (!first || first === lastHandled) return;
    setLastHandled(first);
    setError(null);
    startTransition(async () => {
      try {
        const result = await pickupByTokenAction(tenantSlug, first);
        setActive(false);
        router.replace(
          `/${tenantSlug}/conserjeria/retiro?ok=Depto+${encodeURIComponent(result.unitLabel)}`,
        );
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "ERROR";
        setError(msg);
        // Allow another scan attempt.
        setTimeout(() => setLastHandled(null), 1500);
      }
    });
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setActive(true);
        }}
        className="w-full rounded-lg border-2 border-brand px-4 py-3 font-semibold text-brand"
      >
        Escanear QR con la cámara
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-black">
        <Scanner
          onScan={handleDetect}
          onError={(err) => setError(err instanceof Error ? err.message : "Error de cámara")}
          constraints={{ facingMode: "environment" }}
          formats={["qr_code"]}
        />
      </div>
      {scanning && <p className="text-sm text-slate-500">Procesando…</p>}
      {error && (
        <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setActive(false)}
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      >
        Cancelar
      </button>
    </div>
  );
}
