interface PackageCardProps {
  unitLabel: string;
  pickupCode: string;
  carrier: string | null;
  receivedAt: Date;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  if (ms < HOUR) {
    const m = Math.max(1, Math.round(ms / 60000));
    return `hace ${m} min`;
  }
  if (ms < DAY) {
    const h = Math.round(ms / HOUR);
    return `hace ${h} h`;
  }
  const d = Math.floor(ms / DAY);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

function ageTone(date: Date): "fresh" | "aging" | "stale" {
  const ms = Date.now() - date.getTime();
  if (ms < 1 * DAY) return "fresh";
  if (ms < 3 * DAY) return "aging";
  return "stale";
}

const TONE_STYLES = {
  fresh: "border-ink-700",
  aging: "border-accent/40",
  stale: "border-warn/60",
} as const;

export function PackageCard({ unitLabel, pickupCode, carrier, receivedAt }: PackageCardProps) {
  const tone = ageTone(receivedAt);
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-2xl border bg-ink-800 px-5 py-4 transition-colors animate-slide-in-down ${TONE_STYLES[tone]}`}
    >
      <div className="flex min-w-0 items-center gap-5">
        <span className="font-mono text-4xl font-bold tabular-nums text-ink-100">
          {unitLabel}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-300">
            {carrier ?? "Sin transportista"}
          </p>
          <p className={`text-xs ${tone === "stale" ? "text-warn" : "text-ink-400"}`}>
            {timeAgo(receivedAt)}
            {tone === "stale" && " · recordar"}
          </p>
        </div>
      </div>
      <code
        className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-base font-semibold tracking-widest text-accent"
        aria-label="Código de retiro"
      >
        {pickupCode}
      </code>
    </li>
  );
}
