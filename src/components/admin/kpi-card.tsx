import Link from "next/link";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "accent" | "positive" | "warn";
  href?: string;
}

const TONES = {
  neutral: "border-ink-700 bg-ink-850 text-ink-100",
  accent: "border-accent/40 bg-accent/10 text-accent",
  positive: "border-positive/40 bg-positive/10 text-positive",
  warn: "border-warn/40 bg-warn/10 text-warn",
} as const;

export function KpiCard({ label, value, hint, tone = "neutral", href }: Props) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </>
  );
  const base = `rounded-2xl border px-5 py-4 ${TONES[tone]}`;
  if (!href) return <div className={base}>{body}</div>;
  return (
    <Link
      href={href}
      className={`${base} block transition-colors hover:border-ink-500 hover:bg-ink-800`}
    >
      {body}
    </Link>
  );
}
