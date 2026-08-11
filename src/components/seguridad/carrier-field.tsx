"use client";

import { useState } from "react";
import { advanceTo } from "./advance";

// Campo de transportista con chips de los ya usados en el edificio.
//
// Tocar un chip llena el input con la grafía exacta del historial — así el
// ranking de reportes no se fragmenta entre "Mercado Libre" y "mercadolibre".
// El texto libre sigue disponible para un transportista nuevo.
export function CarrierField({
  name,
  suggestions,
  advanceToId,
}: {
  name: string;
  suggestions: string[];
  /** Sección a la que scrollear al elegir un chip, para encadenar la carga. */
  advanceToId?: string;
}) {
  const [value, setValue] = useState("");

  function pick(s: string) {
    // Re-tocar el chip elegido lo deselecciona (el transportista es opcional).
    const next = value === s ? "" : s;
    setValue(next);
    if (next) advanceTo(advanceToId);
  }

  return (
    <div className="flex flex-col gap-2">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="listbox" aria-label="Transportistas usados">
          {suggestions.map((s) => {
            const active = value === s;
            return (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(s)}
                className={
                  active
                    ? "rounded-xl border-2 border-accent bg-accent/15 px-3 py-2 text-sm font-semibold text-accent"
                    : "rounded-xl border-2 border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-200 transition-colors hover:border-ink-500"
                }
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={suggestions.length > 0 ? "Otro transportista…" : "Andreani, OCA, Mercado Libre…"}
        className="w-full rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
      />
    </div>
  );
}
