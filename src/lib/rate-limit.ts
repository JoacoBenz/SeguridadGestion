// Rate limiter con dos backends detrás de la misma función:
//
// - Con UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN: ventana fija en
//   Redis vía REST (INCR + PEXPIRE en un pipeline) — límite real compartido
//   entre todas las instancias serverless. Sin dependencia: es un fetch.
// - Sin esas envs (dev, o hasta configurar la cuenta): el mapa en memoria de
//   siempre. En serverless cada instancia tiene su propio mapa, así que es
//   mitigación best-effort — sirve contra scrapers y loops accidentales.
//
// En ambos backends la filosofía es fail-open: un error del store deja pasar
// tráfico de más, nunca bloquea tráfico legítimo. El throttle durable de magic
// links usa la tabla VerificationToken y no depende de esto.

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

export async function rateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<{ ok: boolean }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return upstashLimit(url, token, key, opts);
  }
  return memoryLimit(key, opts);
}

// --- Backend Upstash (ventana fija) ---------------------------------------

async function upstashLimit(
  baseUrl: string,
  token: string,
  key: string,
  opts: RateLimitOptions,
): Promise<{ ok: boolean }> {
  // Ventana fija: la clave incluye el número de ventana, así el contador
  // muere solo con el PEXPIRE y no hay que limpiar nada.
  const windowId = Math.floor(Date.now() / opts.windowMs);
  const redisKey = `rl:${key}:${windowId}`;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        // Un margen de una ventana extra evita que la clave expire justo
        // mientras la ventana sigue abierta por skew de reloj.
        ["PEXPIRE", redisKey, String(opts.windowMs * 2)],
      ]),
      // Un limiter lento es peor que un limiter ausente: si Upstash no
      // responde rápido, dejamos pasar.
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const results = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(results[0]?.result);
    if (!Number.isFinite(count)) throw new Error(results[0]?.error ?? "respuesta inválida");
    return { ok: count <= opts.limit };
  } catch (err) {
    console.error(`[rate-limit] Upstash falló para ${key}, dejando pasar:`, err);
    return { ok: true };
  }
}

// --- Backend en memoria (fallback) -----------------------------------------

function memoryLimit(key: string, opts: RateLimitOptions): { ok: boolean } {
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
