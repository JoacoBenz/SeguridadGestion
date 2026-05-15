interface AuthorizationCardProps {
  unitLabel: string;
  who: string;
  kind: "visitor" | "recurring";
  detail: string;
  vehiclePlate?: string | null;
  onVacation?: boolean;
}

const KIND_TONE = {
  visitor: "border-accent/30",
  recurring: "border-ink-700",
} as const;

export function AuthorizationCard({
  unitLabel,
  who,
  kind,
  detail,
  vehiclePlate,
  onVacation,
}: AuthorizationCardProps) {
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-2xl border bg-ink-800 px-5 py-4 ${KIND_TONE[kind]}`}
    >
      <div className="flex min-w-0 items-center gap-5">
        <span className="font-mono text-3xl font-bold tabular-nums text-ink-100">
          {unitLabel}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink-100">
            {who}
            {vehiclePlate && (
              <span className="rounded-md border border-ink-700 bg-ink-900 px-1.5 py-0.5 font-mono text-xs text-ink-300">
                {vehiclePlate}
              </span>
            )}
            {onVacation && (
              <span className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warn">
                en vacaciones
              </span>
            )}
          </p>
          <p className="text-xs text-ink-400">{detail}</p>
        </div>
      </div>
      <span className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-[10px] uppercase tracking-wider text-ink-400">
        {kind === "visitor" ? "visita" : "fijo"}
      </span>
    </li>
  );
}
