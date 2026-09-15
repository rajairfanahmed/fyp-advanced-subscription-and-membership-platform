/**
 * Process-local sliding-window rate limiter.
 *
 * Safe for the Edge middleware bundle (no Node built-ins). Each isolate
 * keeps its own map, which is enough to blunt bursts and credential stuffing
 * against this instance. Pair with Clerk's own throttling for login.
 */

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
};

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
let opsSinceSweep = 0;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < 60 * 60 * 1000);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  opsSinceSweep += 1;
  if (opsSinceSweep >= 250) {
    opsSinceSweep = 0;
    sweep(now);
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSec, limit };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.hits.length),
    retryAfterSec: 0,
    limit,
  };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "Retry-After": String(result.retryAfterSec || 0),
    "Cache-Control": "no-store",
  };
}
