// Rate limiter de ventana deslizante en memoria. En serverless (Vercel) cada
// instancia tiene su propio mapa, así que esto es mitigación best-effort, no
// una garantía — sirve contra scrapers y loops accidentales. Para un límite
// duro multi-instancia hace falta un store compartido (Upstash/Redis); el
// throttle durable de magic links usa la tabla VerificationToken en su lugar.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 10_000;

export interface RateLimitOptions {
  // Cantidad de hits permitidos por ventana.
  limit: number;
  // Largo de la ventana en milisegundos.
  windowMs: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): { ok: boolean } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  bucket.count += 1;
  return { ok: bucket.count <= opts.limit };
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Si todo sigue vivo (ataque distribuido llenando claves), vaciamos: peor
  // caso dejamos pasar tráfico de más, nunca bloqueamos tráfico legítimo.
  if (buckets.size >= MAX_BUCKETS) buckets.clear();
}

// Para tests.
export function resetRateLimiter(): void {
  buckets.clear();
}
