/**
 * Tiny in-memory token-bucket rate limiter, scoped to the Node runtime.
 *
 * Keyed by IP for v0. When auth lands, swap key to `${orgId}:${userId}`.
 *
 * For multi-instance deploys, replace the in-memory `Map` with Redis or
 * Upstash. The public surface (`limit(...)`) stays the same.
 */

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const BUCKETS = new Map<string, Bucket>();

// Periodically prune dead buckets so memory doesn't grow without bound.
let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  const cutoff = now - 5 * 60_000;
  for (const [k, b] of BUCKETS.entries()) {
    if (b.lastRefill < cutoff) BUCKETS.delete(k);
  }
}

export type RateLimitOpts = {
  /** Refill rate in tokens per second. */
  rate: number;
  /** Bucket capacity (max burst). */
  burst: number;
  /** How many tokens this call consumes. Defaults to 1. */
  cost?: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Remaining tokens after the call (floor for display). */
  remaining: number;
  /** Seconds until next token refills. */
  retryAfter: number;
  /** Bucket capacity. */
  limit: number;
};

export function limit(key: string, opts: RateLimitOpts): RateLimitResult {
  maybePrune();
  const cost = opts.cost ?? 1;
  const now = Date.now();
  let b = BUCKETS.get(key);
  if (!b) {
    b = { tokens: opts.burst, lastRefill: now };
    BUCKETS.set(key, b);
  }
  // Refill since last touch.
  const elapsedSec = (now - b.lastRefill) / 1000;
  if (elapsedSec > 0) {
    b.tokens = Math.min(opts.burst, b.tokens + elapsedSec * opts.rate);
    b.lastRefill = now;
  }
  if (b.tokens >= cost) {
    b.tokens -= cost;
    return {
      ok: true,
      remaining: Math.floor(b.tokens),
      retryAfter: 0,
      limit: opts.burst,
    };
  }
  const need = cost - b.tokens;
  const retryAfter = Math.ceil(need / opts.rate);
  return {
    ok: false,
    remaining: Math.floor(b.tokens),
    retryAfter,
    limit: opts.burst,
  };
}

/**
 * Best-effort IP extraction from a Next.js Request. Honors common reverse-
 * proxy headers but never trusts them blindly for security decisions —
 * rate-limiting forgery just hurts the forger here, so it's fine.
 */
export function ipFromRequest(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

/**
 * Wrap a Next.js POST handler with rate-limiting and an optional body-size cap.
 *
 *   export const POST = withRateLimit(originalPost, {
 *     bucket: "api.chat",
 *     opts: { rate: 1, burst: 30 },        // 30 burst, refill 1/s
 *     maxBytes: 2 * 1024 * 1024,           // 2 MB body cap
 *   });
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response> | Response,
  cfg: { bucket: string; opts: RateLimitOpts; maxBytes?: number }
) {
  return async (req: Request): Promise<Response> => {
    const ip = ipFromRequest(req);
    const key = `${cfg.bucket}:${ip}`;
    const r = limit(key, cfg.opts);
    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: "rate_limited", retryAfter: r.retryAfter }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(r.retryAfter),
            "X-RateLimit-Limit": String(r.limit),
            "X-RateLimit-Remaining": String(r.remaining),
          },
        }
      );
    }

    if (typeof cfg.maxBytes === "number") {
      const cl = req.headers.get("content-length");
      if (cl) {
        const n = Number(cl);
        if (Number.isFinite(n) && n > cfg.maxBytes) {
          return new Response(
            JSON.stringify({ error: "payload_too_large", maxBytes: cfg.maxBytes }),
            { status: 413, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    const res = await handler(req);
    res.headers.set("X-RateLimit-Limit", String(r.limit));
    res.headers.set("X-RateLimit-Remaining", String(r.remaining));
    return res;
  };
}
