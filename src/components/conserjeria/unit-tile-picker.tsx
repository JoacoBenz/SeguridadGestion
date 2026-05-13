"use client";

import { useState } from "react";

export interface UnitOption {
  id: string;
  label: string;
}

interface Props {
  name: string;
  units: UnitOption[];
}

export function UnitTilePicker({ name, units }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      <input type="hidden" name={name} value={selectedId ?? ""} required />
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {units.map((u) => {
          const active = u.id === selectedId;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedId(u.id)}
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
  );
}
