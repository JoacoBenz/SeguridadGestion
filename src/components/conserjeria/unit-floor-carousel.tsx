"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UnitOption {
  id: string;
  label: string;
}

interface Props {
  name: string;
  units: UnitOption[];
}

interface FloorGroup {
  key: string;
  display: string;
  units: UnitOption[];
}

// Parse "1A" → { floor: "1", suffix: "A" }. Unparseable labels go under "—".
function groupByFloor(units: UnitOption[]): FloorGroup[] {
  const buckets = new Map<string, UnitOption[]>();
  for (const u of units) {
    const m = /^(\d+)/.exec(u.label);
    const key = m ? m[1]! : "—";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(u);
  }

  const keys = Array.from(buckets.keys()).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) && Number.isNaN(nb)) return a.localeCompare(b);
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return na - nb;
  });

  return keys.map((k) => ({
    key: k,
    display: k === "—" ? "Otros" : `Piso ${k}`,
    units: buckets.get(k)!.sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

export function UnitFloorCarousel({ name, units }: Props) {
  const floors = useMemo(() => groupByFloor(units), [units]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const floorChipsRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const selected = useMemo(
    () => units.find((u) => u.id === selectedId) ?? null,
    [units, selectedId],
  );

  const scrollToFloor = useCallback((idx: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    isProgrammaticScroll.current = true;
    el.scrollTo({ left: idx * el.clientWidth, behavior });
    // smooth scroll has no completion event; clear the flag after the animation likely settled
    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 450);
  }, []);

  // When user swipes/scrolls the carousel manually, sync active floor.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (isProgrammaticScroll.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        setActiveIdx((prev) => (prev === idx ? prev : idx));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the active floor chip visible.
  useEffect(() => {
    const chips = floorChipsRef.current;
    if (!chips) return;
    const active = chips.querySelector<HTMLButtonElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIdx]);

  const handleFloorClick = useCallback(
    (idx: number) => {
      setActiveIdx(idx);
      scrollToFloor(idx);
    },
    [scrollToFloor],
  );

  if (floors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-850 px-6 py-10 text-center text-sm text-ink-400">
        No hay unidades cargadas. Pedile al admin que cargue al menos una.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={selectedId ?? ""} required />

      <div
        ref={floorChipsRef}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {floors.map((f, idx) => {
          const active = idx === activeIdx;
          return (
            <button
              key={f.key}
              type="button"
              data-active={active}
              onClick={() => handleFloorClick(idx)}
              className={
                active
                  ? "shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-bold uppercase tracking-widest text-accent-fg shadow-[0_0_0_4px_rgba(251,191,36,0.18)] transition-all"
                  : "shrink-0 rounded-full border border-ink-700 bg-ink-850 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-ink-300 transition-colors hover:text-ink-100"
              }
            >
              {f.display}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="snap-x snap-mandatory flex overflow-x-auto rounded-2xl border border-ink-700 bg-ink-900 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {floors.map((f) => (
          <div
            key={f.key}
            className="min-w-full shrink-0 snap-center snap-always p-4"
            aria-hidden={floors[activeIdx]?.key !== f.key}
          >
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {f.units.map((u, i) => {
                const active = u.id === selectedId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedId(u.id)}
                    aria-pressed={active}
                    style={{ animationDelay: `${i * 18}ms` }}
                    className={
                      active
                        ? "aspect-square rounded-2xl border-2 border-accent bg-accent font-mono text-lg font-bold text-accent-fg shadow-[0_0_0_4px_rgba(251,191,36,0.25)] animate-success-pop"
                        : "aspect-square rounded-2xl border-2 border-ink-700 bg-ink-800 font-mono text-lg font-bold text-ink-100 opacity-0 animate-fade-rise transition-colors hover:border-ink-500 active:bg-ink-700"
                    }
                  >
                    {u.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <FloorDots count={floors.length} activeIdx={activeIdx} />

      <div
        aria-live="polite"
        className={
          selected
            ? "flex animate-slide-in-down items-baseline justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-3"
            : "rounded-xl border border-dashed border-ink-700 bg-ink-850 px-4 py-3 text-center text-xs text-ink-400"
        }
      >
        {selected ? (
          <>
            <span className="text-xs uppercase tracking-widest text-accent/80">Seleccionado</span>
            <span className="font-mono text-lg font-bold text-accent">{selected.label}</span>
          </>
        ) : (
          <>Tocá un departamento para elegirlo</>
        )}
      </div>
    </div>
  );
}

function FloorDots({ count, activeIdx }: { count: number; activeIdx: number }) {
  if (count <= 1) return null;
  return (
    <div className="flex justify-center gap-1.5 pt-1">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={
            i === activeIdx
              ? "h-1.5 w-6 rounded-full bg-accent transition-all"
              : "h-1.5 w-1.5 rounded-full bg-ink-700 transition-all"
          }
        />
      ))}
    </div>
  );
}
