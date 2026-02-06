interface RateLimitEntry {
  count: number;
  resetAtMs: number;
}

interface ConsumeRateLimitParams {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}

interface ConsumeRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_RATE_LIMIT_KEYS = 10_000;

function cleanup(nowMs: number): void {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAtMs <= nowMs) {
      rateLimitStore.delete(key);
    }
  }

  if (rateLimitStore.size <= MAX_RATE_LIMIT_KEYS) return;

  const overflow = rateLimitStore.size - MAX_RATE_LIMIT_KEYS;
  const keys = rateLimitStore.keys();
  for (let index = 0; index < overflow; index += 1) {
    const next = keys.next();
    if (next.done) break;
    rateLimitStore.delete(next.value);
  }
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor
      .split(',')
      .map((value) => value.trim())
      .find((value) => value.length > 0);
    if (first) return first;
  }

  const realIp = headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();
  return 'unknown';
}

export function consumeRateLimit(
  params: ConsumeRateLimitParams
): ConsumeRateLimitResult {
  const nowMs = params.nowMs ?? Date.now();
  const windowMs = Math.max(params.windowMs, 1);
  const limit = Math.max(params.limit, 1);
  const key = params.key.trim() || 'unknown';

  cleanup(nowMs);

  const current = rateLimitStore.get(key);
  if (!current || current.resetAtMs <= nowMs) {
    rateLimitStore.set(key, {
      count: 1,
      resetAtMs: nowMs + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterMs: windowMs,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(current.resetAtMs - nowMs, 0),
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return {
    allowed: true,
    remaining: Math.max(limit - current.count, 0),
    retryAfterMs: Math.max(current.resetAtMs - nowMs, 0),
  };
}
