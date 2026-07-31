"use client";

import { useMemo, useState } from "react";
import { compareUnitLabels } from "@/lib/unit-label";

export interface UnitOption {
  id: string;
  label: string;
}

interface Props {
  name: string;
  units: UnitOption[];
}

// A partir de acá la grilla completa deja de entrar en una pantalla de celular
// y aparece el buscador. Debajo de este número, un edificio chico sigue viendo
// todos los deptos de un vistazo, que es lo más rápido para el guardia.
const SEARCH_THRESHOLD = 24;

export function UnitTilePicker({ name, units }: Props) {
  const [selected, setSelected] = useState<UnitOption | null>(null);
  const [query, setQuery] = useState("");

  const searchable = units.length > SEARCH_THRESHOLD;

  // La base ordena por texto, que pone 10A y 30A antes que 1A y 3A. Con pocos
  // deptos no se nota; con 200 el guardia busca "3" y ve el piso 30 primero.
  const sorted = useMemo(
    () => [...units].sort((a, b) => compareUnitLabels(a.label, b.label)),
    [units],
  );

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return sorted;
    // Primero los que empiezan con lo tipeado: buscando "3B" interesa el 3B,
    // no el 13B ni el 23B (que igual aparecen, más abajo).
    const starts: UnitOption[] = [];
    const contains: UnitOption[] = [];
    for (const u of sorted) {
      const label = u.label.toUpperCase();
      if (label.startsWith(q)) starts.push(u);
      else if (label.includes(q)) contains.push(u);
    }
    return [...starts, ...contains];
  }, [sorted, query]);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={selected?.id ?? ""} required />

      {searchable && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar entre ${units.length} deptos — ej. 3B`}
            aria-label="Buscar departamento"
            className="w-full rounded-xl border-2 border-ink-700 bg-ink-850 px-4 py-3 font-mono text-ink-100 placeholder:font-sans placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
          {/* La selección tiene que seguir visible aunque el filtro la esconda:
              si no, el guardia no sabe si le quedó elegido algo. */}
          {selected && (
            <p className="text-sm text-ink-400">
              Seleccionado:{" "}
              <span className="font-mono text-base font-bold text-accent">
                {selected.label}
              </span>
            </p>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-6 text-center text-sm text-ink-400">
          Ningún depto coincide con “{query}”.
        </p>
      ) : (
        <div
          // Con muchas unidades la grilla scrollea por dentro: si creciera hacia
          // abajo, el botón de registrar quedaría a varias pantallas de scroll.
          className={
            searchable
              ? "max-h-[42vh] overflow-y-auto rounded-xl border border-ink-800 p-1"
              : ""
          }
        >
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {visible.map((u) => {
              const active = u.id === selected?.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelected(u)}
                  aria-pressed={active}
                  className={
                    active
                      ? "aspect-square rounded-2xl border-2 border-accent bg-accent font-mono text-xl font-bold text-accent-fg shadow-[0_0_0_4px_rgba(251,191,36,0.15)] transition-all"
                      : "aspect-square rounded-2xl border-2 border-ink-700 bg-ink-800 font-mono text-xl font-bold text-ink-100 transition-colors hover:border-ink-500 active:bg-ink-700"
                  }
                >
                  {u.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
