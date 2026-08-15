"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scanner,
  prepareZXingModule,
  type IDetectedBarcode,
} from "@yudiel/react-qr-scanner";

// El decodificador de QR es WASM, y zxing-wasm lo baja de jsDelivr por
// default: el flujo principal del guardia quedaba colgado de un CDN ajeno (y
// la CSP tendría que abrirle la puerta). `new URL(..., import.meta.url)` hace
// que el bundler emita el .wasm como asset propio — mismo origen, y siempre en
// sync con la versión instalada del paquete.
const wasmUrl = new URL(
  "zxing-wasm/reader/zxing_reader.wasm",
  import.meta.url,
);
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? wasmUrl.href : prefix + path,
  },
});
import {
  pickupByCodeAction,
  pickupByTokenAction,
  type PickupActionResult,
} from "@/server/packages/pickup-actions";
import { OtpCodeInput } from "./otp-code-input";

type Mode = "qr" | "code";

// getUserMedia tira errores con `name` estandarizado y `message` en inglés del
// navegador ("Requested device not found"). El guardia veía ese texto crudo, sin
// saber que el permiso se arregla desde los ajustes del sistema.
function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      // Sin nombrar un navegador: la seguridad puede estar en Chrome, Safari,
      // Samsung Internet o la app instalada, y cada uno lo ubica en otro lado.
      return "La cámara está bloqueada. Habilitá el permiso desde los ajustes del navegador o del teléfono, o usá 'Tipear código'.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Este dispositivo no tiene una cámara disponible. Usá 'Tipear código'.";
    case "NotReadableError":
      return "Otra app está usando la cámara. Cerrala y probá de nuevo, o usá 'Tipear código'.";
    default:
      return "No se pudo abrir la cámara. Usá 'Tipear código' para procesar el retiro.";
  }
}

interface Props {
  tenantSlug: string;
}

// Lo que el popup de éxito necesita mostrar del retiro confirmado.
type DonePickup = Extract<PickupActionResult, { ok: true }>;

export function PickupFlow({ tenantSlug }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("qr");
  const [error, setError] = useState<string | null>(null);
  const [scanning, startTransition] = useTransition();
  const [lastHandled, setLastHandled] = useState<string | null>(null);
  // Al confirmar un retiro reemplazamos el escáner por el popup de éxito.
  // Desmontar <Scanner> es lo que apaga la cámara: si sigue montado el visor
  // queda vivo detrás del cartel y el guardia no sabe si el escaneo funcionó.
  const [done, setDone] = useState<DonePickup | null>(null);

  function handleResult(result: PickupActionResult) {
    if (result.ok) {
      setDone(result);
      // Refresca la lista de pendientes que quedó atrás.
      router.refresh();
    } else {
      setError(result.error);
      setTimeout(() => setLastHandled(null), 1500);
    }
  }

  function onScan(codes: IDetectedBarcode[]) {
    const first = codes[0]?.rawValue;
    if (!first || first === lastHandled) return;
    setLastHandled(first);
    setError(null);
    startTransition(async () => {
      let result: PickupActionResult;
      try {
        result = await pickupByTokenAction(tenantSlug, first);
      } catch {
        // Falla de red o del runtime de la action; el motivo real no llega al cliente.
        result = { ok: false, error: "No se pudo procesar el retiro. Probá de nuevo." };
      }
      handleResult(result);
    });
  }

  // Mismo camino RPC que el QR: el resultado vuelve al componente y los dos
  // modos comparten el popup de éxito (antes el código redirigía a un toast
  // y nunca veía esta pantalla).
  function onCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get("pickupCode");
    if (typeof code !== "string" || !code.trim()) {
      setError("Ingresá el código completo");
      return;
    }
    setError(null);
    startTransition(async () => {
      let result: PickupActionResult;
      try {
        result = await pickupByCodeAction(tenantSlug, code);
      } catch {
        result = { ok: false, error: "No se pudo procesar el retiro. Probá de nuevo." };
      }
      handleResult(result);
    });
  }

  function closeSuccess() {
    setDone(null);
    setError(null);
    setLastHandled(null);
  }

  if (done) {
    return <PickupSuccess pickup={done} tenantSlug={tenantSlug} onClose={closeSuccess} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Segmented mode={mode} onChange={setMode} />

      {mode === "qr" ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-ink-700 bg-black">
            <Scanner
              onScan={onScan}
              onError={(err) => setError(cameraErrorMessage(err))}
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
        <form onSubmit={onCodeSubmit} className="flex flex-col items-center gap-6">
          <OtpCodeInput name="pickupCode" />
          <button
            type="submit"
            disabled={scanning}
            aria-busy={scanning}
            className={`w-full max-w-sm rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98] ${scanning ? "cursor-wait opacity-60" : ""}`}
          >
            {scanning ? "Procesando…" : "Confirmar retiro"}
          </button>
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

// Popup PERSISTENTE del retiro confirmado: no se cierra solo — ni timeout, ni
// tap en el fondo, ni Escape — únicamente con "Cerrar". El guardia lo deja
// abierto mientras busca el paquete en el depósito con la foto a la vista.
// Overlay a mano (no <dialog> nativo) justamente para anular el light-dismiss.
// El <Scanner> quedó desmontado (early return del padre): la cámara está
// apagada mientras esto está en pantalla.
function PickupSuccess({
  pickup,
  tenantSlug,
  onClose,
}: {
  pickup: DonePickup;
  tenantSlug: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Retiro confirmado"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="flex max-h-full w-full max-w-sm flex-col items-center gap-5 overflow-y-auto rounded-2xl border border-positive/40 bg-ink-900 px-6 py-8 text-center">
        {pickup.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pickup.photoUrl}
            alt="Foto del paquete a entregar"
            className="max-h-72 w-full rounded-xl border border-ink-700 object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-20 w-20 items-center justify-center rounded-full bg-positive/20 text-4xl text-positive"
          >
            ✓
          </span>
        )}
        <div>
          <p className="text-2xl font-bold text-positive">Retiro confirmado</p>
          <p className="mt-1 text-lg text-ink-200">
            Depto <span className="font-bold text-ink-100">{pickup.unitLabel}</span>
            {pickup.carrier && (
              <span className="text-ink-300">
                {" "}
                · {pickup.carrier}
              </span>
            )}
          </p>
          {pickup.photoUrl && (
            <p className="mt-2 text-sm text-ink-300">
              Este es el paquete que hay que entregar.
            </p>
          )}
          <p className="mt-2 text-sm text-ink-400">
            El residente recibió el aviso por WhatsApp.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
          >
            Cerrar
          </button>
          <Link
            href={`/${tenantSlug}/seguridad`}
            className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3 font-medium text-ink-200 transition-colors hover:border-ink-500"
          >
            Volver a seguridad
          </Link>
        </div>
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
