import type { Request, Response, NextFunction } from "express";

type Options = {
  windowMs: number;
  max: number;
  /** Key to bucket on. Defaults to the client IP. */
  key?: (req: Request) => string;
  message?: string;
};

type Bucket = { count: number; resetAt: number };

function defaultKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Fixed-window in-memory rate limiter. Single-process (per-instance) — a
 * shared Redis store would be needed for multi-instance fairness. Disabled
 * entirely with RATE_LIMIT_DISABLED=true (e.g. tests/local).
 */
export function rateLimit(opts: Options) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.RATE_LIMIT_DISABLED === "true") return next();

    const now = Date.now();
    // Opportunistic cleanup so abandoned keys don't grow unbounded.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    }

    const key = (opts.key ?? defaultKey)(req);
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, opts.max - bucket.count)));

    if (bucket.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: opts.message ?? "Too many requests, slow down" });
      return;
    }
    next();
  };
}
