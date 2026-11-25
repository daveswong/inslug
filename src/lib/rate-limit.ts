/**
 * 进程内限速。serverless 下内存会随实例回收，所以它只能挡住「同一实例上的高速重试」，
 * 不是硬防线——真正的防线是 6 位码本身只有 100 万种组合 + 30 秒就换。
 * 单用户场景这个强度够了，真要严格得落库。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export type RateResult =
  | { allowed: true }
  | { allowed: false; minutes: number };

export function rateLimit(
  key: string,
  max = 5,
  windowMs = 10 * 60 * 1000
): RateResult {
  const now = Date.now();
  const record = buckets.get(key);
  const withinWindow = record && record.resetAt > now;

  if (withinWindow && record.count >= max) {
    return {
      allowed: false,
      minutes: Math.max(1, Math.ceil((record.resetAt - now) / 60000)),
    };
  }

  buckets.set(key, {
    count: withinWindow ? record.count + 1 : 1,
    resetAt: withinWindow ? record.resetAt : now + windowMs,
  });
  return { allowed: true };
}

/** 成功之后清零，避免正常的连续登录把自己锁住 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** 取来源 IP：Vercel 会把真实 IP 放在 x-forwarded-for 的第一段 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}
