type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit = Number(process.env.UPLOAD_RATE_LIMIT_PHOTOS ?? 30), windowMs = Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS ?? 600000), increment = 1) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: increment, resetAt: now + windowMs });
    return { allowed: increment <= limit, remaining: Math.max(0, limit - increment), resetAt: now + windowMs };
  }
  current.count += increment;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}
