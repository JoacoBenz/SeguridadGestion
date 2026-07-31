"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
  // Al confirmar un retiro reemplazamos el escáner por la pantalla de éxito.
  // Desmontar <Scanner> es lo que apaga la cámara: si sigue montado el visor
  // queda vivo detrás del cartel y el guardia no sabe si el escaneo funcionó.
  const [done, setDone] = useState<string | null>(null);

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
        setDone(result.unitLabel);
        // Refresca la lista de pendientes que quedó atrás.
        router.refresh();
      } else {
        setError(result.error);
        setTimeout(() => setLastHandled(null), 1500);
      }
    });
  }

  function scanAnother() {
    setDone(null);
    setError(null);
    setLastHandled(null);
  }

  if (done) {
    return <PickupSuccess unitLabel={done} tenantSlug={tenantSlug} onScanAnother={scanAnother} />;
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

function PickupSuccess({
  unitLabel,
  tenantSlug,
  onScanAnother,
}: {
  unitLabel: string;
  tenantSlug: string;
  onScanAnother: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-6 rounded-2xl border border-positive/40 bg-positive/10 px-6 py-10 text-center"
    >
      <span
        aria-hidden
        className="flex h-20 w-20 items-center justify-center rounded-full bg-positive/20 text-4xl text-positive"
      >
        ✓
      </span>
      <div>
        <p className="text-2xl font-bold text-positive">Retiro confirmado</p>
        <p className="mt-1 text-ink-200">
          Depto <span className="font-semibold text-ink-100">{unitLabel}</span>
        </p>
        <p className="mt-3 text-sm text-ink-400">
          El residente recibió el aviso por WhatsApp.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={onScanAnother}
          className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Escanear otro
        </button>
        <Link
          href={`/${tenantSlug}/conserjeria`}
          className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3 font-medium text-ink-200 transition-colors hover:border-ink-500"
        >
          Volver a conserjería
        </Link>
      </div>
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
