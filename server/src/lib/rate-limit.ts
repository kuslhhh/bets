import type { MiddlewareHandler } from "hono";

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit({ windowMs = 60_000, max = 10, keyPrefix = "global" }: { windowMs?: number; max?: number; keyPrefix?: string }): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
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
