import "server-only";

/**
 * Fixed-window rate limiting, in memory.
 *
 * Each server instance keeps its own counters. On Vercel, warm instances are reused
 * across requests, so this stops casual abuse (someone spamming the chat) at no cost
 * and with no extra services. For strict limits across all instances, swap the Map for
 * a shared store such as Upstash Redis.
 */

interface Window {
  count: number;
  resetAt: number;
}

export interface Limit {
  /** Requests allowed per window. 0 disables the limit. */
  max: number;
  windowMs: number;
}

export interface LimitResult {
  ok: boolean;
  retryAfterS: number;
}

const buckets = new Map<string, Map<string, Window>>();

export function checkLimit(bucket: string, key: string, limit: Limit, now = Date.now()): LimitResult {
  if (limit.max <= 0) return { ok: true, retryAfterS: 0 };

  let windows = buckets.get(bucket);
  if (!windows) buckets.set(bucket, (windows = new Map()));

  // Drop expired windows now and then so memory stays bounded.
  if (windows.size > 5000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { ok: true, retryAfterS: 0 };
  }
  if (w.count >= limit.max) {
    return { ok: false, retryAfterS: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  }
  w.count += 1;
  return { ok: true, retryAfterS: 0 };
}

/** Best-effort client IP. Vercel sets x-forwarded-for, with the real client first. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Parse "20/600" (max requests / window seconds) from an env var. */
export function parseLimit(value: string | undefined, fallback: Limit): Limit {
  const m = value?.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? { max: Number(m[1]), windowMs: Number(m[2]) * 1000 } : fallback;
}

/**
 * Apply a per-visitor limit and a per-instance global limit. Returns a 429 response
 * when either is exceeded, or null when the request may proceed.
 */
export function enforceLimits(
  req: Request,
  name: string,
  perVisitor: Limit,
  global: Limit,
): Response | null {
  const ip = clientIp(req);
  const visitor = checkLimit(`${name}:ip`, ip, perVisitor);
  const all = visitor.ok ? checkLimit(`${name}:global`, "all", global) : visitor;
  if (visitor.ok && all.ok) return null;

  const busy = visitor.ok; // per-visitor was fine, so the site-wide cap was hit
  console.warn(JSON.stringify({ evt: "rate_limited", route: name, scope: busy ? "global" : "visitor" }));
  return Response.json(
    {
      code: "rate_limited",
      message: busy
        ? "The assistant is getting a lot of requests right now. Please try again in a few minutes."
        : `You're sending messages quickly. Please wait ${formatWait(all.retryAfterS)} and try again.`,
    },
    { status: 429, headers: { "retry-after": String(all.retryAfterS) } },
  );
}

function formatWait(s: number): string {
  return s < 60 ? `${s} seconds` : `${Math.ceil(s / 60)} minute${s >= 120 ? "s" : ""}`;
}
