// Fixed-window per-IP rate limiting for the public endpoints.
//
// Email verification raises the cost of filing junk - you need a mailbox you
// control - but it does not cap the rate, and someone with one mailbox can
// still hammer submit. This is the cap.
//
// In-memory and per-process, which is honest for a single container but wrong
// behind more than one: each replica would keep its own counters, and a
// restart resets them. The real control belongs at the edge (Caddy's
// rate_limit, or a WAF) where it sees every request and costs the app nothing.

const buckets = new Map(); // key -> { count, resetAt }

/** Trust the proxy's forwarded address, since Caddy sits in front in production. */
function clientKey(req) {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function sweep(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * @param {object} options
 * @param {number} options.limit    requests allowed per window
 * @param {number} options.windowMs window length
 * @param {string} options.name     bucket namespace, so two limiters do not share counters
 */
export function rateLimit({ limit, windowMs, name }) {
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    sweep(now); // keeps the map from growing without bound

    const key = `${name}:${clientKey(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
      });
    }

    return next();
  };
}

/** Test seam. */
export function __resetRateLimits() {
  buckets.clear();
}
