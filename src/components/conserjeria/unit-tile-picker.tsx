"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// 4 columnas x 5 filas: la grilla más grande que entra en el pulgar sin
// achicar los botones ni empujar el resto del formulario fuera de pantalla.
const COLS = 4;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;

export function UnitTilePicker({ name, units }: Props) {
  const [selected, setSelected] = useState<UnitOption | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

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

  // Con pocas unidades no hay carrusel: entran todas de un vistazo, que es lo
  // más rápido en el mostrador.
  const paged = visible.length > PER_PAGE;
  const pages: UnitOption[][] = [];
  if (paged) {
    for (let i = 0; i < visible.length; i += PER_PAGE) {
      pages.push(visible.slice(i, i + PER_PAGE));
    }
  }

  // Filtrar cambia el conjunto: quedarse en la página 3 mostraría un hueco.
  useEffect(() => {
    setPage(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [query]);

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
      ) : paged ? (
        <div className="flex flex-col gap-2">
          {/* Carrusel horizontal: cada página es una grilla 4x5 que ocupa todo
              el ancho. El scroll-snap lo hace el navegador, así el gesto tiene
              la inercia nativa del sistema en vez de una imitación en JS. */}
          <div
            ref={trackRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const next = Math.round(el.scrollLeft / el.clientWidth);
              if (next !== page) setPage(next);
            }}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={`Departamentos, página ${page + 1} de ${pages.length}`}
          >
            {pages.map((chunk, i) => (
              <div
                key={i}
                className="grid w-full flex-none snap-start grid-cols-4 grid-rows-5 gap-2 sm:gap-3"
              >
                {chunk.map((u) => (
                  <Tile
                    key={u.id}
                    unit={u}
                    active={u.id === selected?.id}
                    onSelect={() => setSelected(u)}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3">
            <PageArrow
              dir="prev"
              disabled={page === 0}
              onClick={() => scrollToPage(trackRef.current, page - 1)}
            />
            <span className="font-mono text-xs tabular-nums text-ink-400">
              {page + 1} / {pages.length}
            </span>
            <PageArrow
              dir="next"
              disabled={page >= pages.length - 1}
              onClick={() => scrollToPage(trackRef.current, page + 1)}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {visible.map((u) => (
            <Tile
              key={u.id}
              unit={u}
              active={u.id === selected?.id}
              onSelect={() => setSelected(u)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function scrollToPage(track: HTMLDivElement | null, index: number) {
  if (!track) return;
  track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
}

function Tile({
  unit,
  active,
  onSelect,
}: {
  unit: UnitOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        active
          ? "aspect-square rounded-2xl border-2 border-accent bg-accent font-mono text-xl font-bold text-accent-fg shadow-[0_0_0_4px_rgba(251,191,36,0.15)] transition-all"
          : "aspect-square rounded-2xl border-2 border-ink-700 bg-ink-800 font-mono text-xl font-bold text-ink-100 transition-colors hover:border-ink-500 active:bg-ink-700"
      }
    >
      {unit.label}
    </button>
  );
}

// Flechas para quien usa la tablet con mouse o no descubre el gesto.
function PageArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Departamentos anteriores" : "Departamentos siguientes"}
      className={
        disabled
          ? "flex h-9 w-9 items-center justify-center rounded-xl border border-ink-800 text-ink-600"
          : "flex h-9 w-9 items-center justify-center rounded-xl border border-ink-700 text-ink-200 transition-colors hover:border-accent/60 hover:text-accent"
      }
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}
