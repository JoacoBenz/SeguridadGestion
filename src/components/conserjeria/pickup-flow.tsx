"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { pickupByTokenAction } from "@/server/packages/pickup-actions";
import { OtpCodeInput } from "./otp-code-input";
import { SubmitButton } from "@/components/submit-button";

type Mode = "qr" | "code";

interface Props {
  tenantSlug: string;
  codeAction: (formData: FormData) => Promise<void>;
}

export function PickupFlow({ tenantSlug, codeAction }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("qr");
  const [error, setError] = useState<string | null>(null);
  const [scanning, startTransition] = useTransition();
  const [lastHandled, setLastHandled] = useState<string | null>(null);

  function onScan(codes: IDetectedBarcode[]) {
    const first = codes[0]?.rawValue;
    if (!first || first === lastHandled) return;
    setLastHandled(first);
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof pickupByTokenAction>>;
      try {
        result = await pickupByTokenAction(tenantSlug, first);
      } catch {
        // Falla de red o del runtime de la action; el motivo real no llega al cliente.
        result = { ok: false, error: "No se pudo procesar el retiro. Probá de nuevo." };
      }
      if (result.ok) {
        router.replace(
          `/${tenantSlug}/conserjeria/retiro?ok=${encodeURIComponent(`Depto ${result.unitLabel}`)}`,
        );
        router.refresh();
      } else {
        setError(result.error);
        setTimeout(() => setLastHandled(null), 1500);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Segmented mode={mode} onChange={setMode} />

      {mode === "qr" ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-ink-700 bg-black">
            <Scanner
              onScan={onScan}
              onError={(err) =>
                setError(err instanceof Error ? err.message : "Error de cámara")
              }
              constraints={{ facingMode: "environment" }}
              formats={["qr_code"]}
              styles={{ container: { width: "100%", aspectRatio: "1 / 1" } }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-accent/60 shadow-[0_0_12px_4px_rgba(251,191,36,0.4)] animate-scan-line"
            />
          </div>
          <p className="text-sm text-ink-400">
            {scanning ? "Procesando…" : "Apuntá al QR del residente"}
          </p>
        </div>
      ) : (
        <form action={codeAction} className="flex flex-col items-center gap-6">
          <OtpCodeInput name="pickupCode" />
          <SubmitButton
            pendingText="Procesando…"
            className="w-full max-w-sm rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
          >
            Confirmar retiro
          </SubmitButton>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="mx-auto max-w-sm rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-center text-sm text-critical"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function Segmented({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Modo de retiro"
      className="mx-auto flex w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-850 p-1"
    >
      <SegmentedButton
        active={mode === "qr"}
        onClick={() => onChange("qr")}
        label="Escanear QR"
        icon="📷"
      />
      <SegmentedButton
        active={mode === "code"}
        onClick={() => onChange("code")}
        label="Tipear código"
        icon="⌨"
      />
    </div>
  );
}

function SegmentedButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-colors"
          : "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-ink-300 transition-colors hover:text-ink-100"
      }
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}
