"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { pickupByTokenAction } from "@/server/packages/pickup-actions";
import { OtpCodeInput } from "./otp-code-input";

type Mode = "qr" | "code";

interface Props {
  tenantSlug: string;
  codeAction: (formData: FormData) => Promise<void>;
}

interface QrSuccess {
  unitLabel: string;
}

const POPUP_MS = 1600;

export function PickupFlow({ tenantSlug, codeAction }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("qr");
  const [error, setError] = useState<string | null>(null);
  const [scanning, startTransition] = useTransition();
  const [lastHandled, setLastHandled] = useState<string | null>(null);
  const [qrSuccess, setQrSuccess] = useState<QrSuccess | null>(null);

  function onScan(codes: IDetectedBarcode[]) {
    const first = codes[0]?.rawValue;
    if (!first || first === lastHandled || qrSuccess) return;
    setLastHandled(first);
    setError(null);
    startTransition(async () => {
      try {
        const result = await pickupByTokenAction(tenantSlug, first);
        setQrSuccess({ unitLabel: result.unitLabel });
        setTimeout(() => {
          router.replace(`/${tenantSlug}/conserjeria`);
          router.refresh();
        }, POPUP_MS);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ERROR");
        setTimeout(() => setLastHandled(null), 1500);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Segmented mode={mode} onChange={setMode} disabled={!!qrSuccess} />

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
              paused={!!qrSuccess}
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
          <button
            type="submit"
            className="w-full max-w-sm rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
          >
            Confirmar retiro
          </button>
        </form>
      )}

      {error && !qrSuccess && (
        <p
          role="alert"
          className="mx-auto max-w-sm animate-slide-in-down rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-center text-sm text-critical"
        >
          {error}
        </p>
      )}

      {qrSuccess && <QrSuccessPopup unitLabel={qrSuccess.unitLabel} />}
    </div>
  );
}

function QrSuccessPopup({ unitLabel }: { unitLabel: string }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 px-6 opacity-0 backdrop-blur-sm animate-backdrop-in"
    >
      <div className="relative flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-positive/40 bg-ink-900 px-6 py-8 text-center opacity-0 animate-success-pop shadow-[0_24px_60px_-12px_rgba(52,211,153,0.35)]">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-positive/60 animate-halo-ring"
          />
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-positive/15">
            <svg
              viewBox="0 0 32 32"
              className="h-12 w-12"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path
                d="M7 16.5 L13.5 23 L25 10"
                className="text-positive animate-check-stroke"
                style={{ strokeDasharray: 30, strokeDashoffset: 30 }}
              />
            </svg>
          </span>
        </div>
        <div className="opacity-0 animate-fade-rise" style={{ animationDelay: "260ms" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-positive">
            QR escaneado
          </p>
          <p className="mt-2 text-2xl font-bold text-ink-100">Entregá al residente</p>
          <p className="mt-3 text-sm text-ink-400">
            Depto{" "}
            <span className="font-mono text-base font-semibold text-accent">
              {unitLabel}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Segmented({
  mode,
  onChange,
  disabled,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Modo de retiro"
      className={
        disabled
          ? "pointer-events-none mx-auto flex w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-850 p-1 opacity-60"
          : "mx-auto flex w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-850 p-1"
      }
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
