/**
 * Lightweight in-memory IP-based rate limiter for Next.js Route Handlers.
 * No external dependencies required.
 *
 * Each IP is allowed `maxRequests` within a sliding `windowMs` window.
 * The map is pruned lazily to avoid memory leaks on long-lived servers.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Prune stale entries every 5 minutes
let lastPrune = Date.now()
function maybePrune() {
  const now = Date.now()
  if (now - lastPrune < 5 * 60 * 1000) return
  lastPrune = now
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

interface RateLimitOptions {
  /** Maximum requests allowed within the window. Default: 5 */
  maxRequests?: number
  /** Window duration in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(ip: string, opts: RateLimitOptions = {}): RateLimitResult {
  maybePrune()

  const maxRequests = opts.maxRequests ?? 5
  const windowMs   = opts.windowMs   ?? 60_000
  const now = Date.now()

  let entry = store.get(ip)
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs }
    store.set(ip, entry)
  }

  entry.count += 1
  const allowed   = entry.count <= maxRequests
  const remaining = Math.max(0, maxRequests - entry.count)

  return { allowed, remaining, resetAt: entry.resetAt }
}

/** Extract the real client IP from Next.js request headers. */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
