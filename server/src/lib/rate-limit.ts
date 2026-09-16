import type { MiddlewareHandler } from "hono";

// Fixed-window in-memory rate limiter (same behavior as before).
// NOTE: state is per-process, so on Vercel serverless each instance counts
// independently — this is abuse friction, not a hard guarantee. The Map is
// bounded (expired entries pruned, hard cap) so it can't leak memory.
const hits = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

function prune(now: number): void {
  if (hits.size < MAX_KEYS) return;
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
    if (hits.size < MAX_KEYS / 2) break;
  }
}

export function rateLimit({ windowMs = 60_000, max = 10, keyPrefix = "global" }: { windowMs?: number; max?: number; keyPrefix?: string }): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    prune(now);
    let entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      return c.json({ error: "locked", details: "rate limit exceeded" }, 429 as any);
    }
    await next();
  };
}
