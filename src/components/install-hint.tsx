"use client";

import { useEffect, useState } from "react";
import {
  INSTALL_HINT_DISMISSED_KEY,
  detectInstallPlatform,
  isStandalone,
  type InstallPlatform,
} from "@/lib/install-hint";

// Cartel que explica cómo dejar PackItO como app en la pantalla de inicio.
//
// Es sólo instructivo: sin service worker no hay `beforeinstallprompt` en
// Chrome, y en iOS no existe la API en absoluto. Instalarlo abre la app en su
// propia ventana, sin la barra del navegador — que en un teléfono son unos
// 100px de pantalla que el guardia recupera.

export function InstallHint() {
  // `null` mientras no sabemos: en el server no hay navigator, y decidir en el
  // primer render rompería la hidratación.
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);

  useEffect(() => {
    if (localStorage.getItem(INSTALL_HINT_DISMISSED_KEY)) return;

    const standalone = isStandalone(
      window.matchMedia("(display-mode: standalone)").matches,
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    );
    if (standalone) return;

    const detected = detectInstallPlatform(
      window.navigator.userAgent,
      window.navigator.maxTouchPoints,
    );
    // En escritorio el navegador ya ofrece instalar desde la barra de
    // direcciones, así que un cartel nuestro sería ruido.
    if (detected === "other") return;

    setPlatform(detected);
  }, []);

  function dismiss() {
    localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, "1");
    setPlatform(null);
  }

  if (!platform) return null;

  return (
    <aside className="mt-8 rounded-2xl border border-ink-700 bg-ink-850 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink-100">
          Dejalo a mano en tu teléfono
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="No mostrar de nuevo"
          className="-m-2 shrink-0 p-2 text-lg leading-none text-ink-500 transition-colors hover:text-ink-200"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-400">
        Se abre como una app, sin la barra del navegador.
      </p>
      {platform === "ios" ? <IosSteps /> : <AndroidSteps />}
    </aside>
  );
}

function IosSteps() {
  return (
    <ol className="mt-3 flex flex-col gap-2 text-sm text-ink-300">
      <Step n={1}>
        Tocá <ShareIcon /> <strong className="text-ink-100">Compartir</strong>, abajo en
        la barra del navegador
      </Step>
      <Step n={2}>
        Bajá y elegí{" "}
        <strong className="text-ink-100">Agregar a pantalla de inicio</strong>
      </Step>
      <Step n={3}>
        Tocá <strong className="text-ink-100">Agregar</strong>
      </Step>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="mt-3 flex flex-col gap-2 text-sm text-ink-300">
      <Step n={1}>
        Abrí el menú <strong className="text-ink-100">⋮</strong> arriba a la derecha
      </Step>
      <Step n={2}>
        Elegí <strong className="text-ink-100">Instalar app</strong> o{" "}
        <strong className="text-ink-100">Agregar a pantalla principal</strong>
      </Step>
      <Step n={3}>
        Confirmá con <strong className="text-ink-100">Instalar</strong>
      </Step>
    </ol>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink-800 font-mono text-xs font-bold text-accent">
        {n}
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}

// El ícono de compartir de iOS. Sin esto la instrucción obliga a adivinar cuál
// de los botones de la barra es.
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      aria-hidden
      className="inline-block -mt-0.5 align-middle"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  );
}
