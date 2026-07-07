import "server-only";

/**
 * A minimal in-memory fixed-window rate limiter.
 *
 * Scope: this protects a single server instance and is intended to blunt
 * brute-force login attempts in this assessment. For a horizontally-scaled
 * production deployment this would be backed by a shared store (e.g. Redis with
 * `INCR`+`EXPIRE`, or an edge rate-limiter) so the limit is enforced globally.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (for a `Retry-After` header). */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining,
    retryAfter: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Best-effort client identifier from proxy headers, falling back to a constant.
 * (Behind a trusted proxy, `x-forwarded-for`'s first hop is the client.)
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
