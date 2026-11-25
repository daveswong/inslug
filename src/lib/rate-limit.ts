import { getDb } from "./mongodb";

/**
 * 落库限速。原来的进程内 Map 在 Vercel 上每个实例各算各的、重启就清零，
 * 等于形同虚设。这里改用 rate_limits 集合，所有实例共享同一份计数。
 *
 * 仍是「软」限速：6 位码本身 100 万种组合 + 30 秒轮换，才是真正的防线。
 */

interface LimitDoc {
  _id: string;
  count: number;
  resetAt: number;
}

export type RateResult =
  | { allowed: true }
  | { allowed: false; minutes: number };

export async function rateLimit(
  key: string,
  max = 5,
  windowMs = 10 * 60 * 1000
): Promise<RateResult> {
  const col = (await getDb()).collection<LimitDoc>("rate_limits");
  const now = Date.now();
  const doc = await col.findOne({ _id: key });
  const withinWindow = doc && doc.resetAt > now;

  if (withinWindow && doc.count >= max) {
    return {
      allowed: false,
      minutes: Math.max(1, Math.ceil((doc.resetAt - now) / 60000)),
    };
  }

  await col.updateOne(
    { _id: key },
    {
      $set: {
        count: withinWindow ? doc.count + 1 : 1,
        resetAt: withinWindow ? doc.resetAt : now + windowMs,
      },
    },
    { upsert: true }
  );
  return { allowed: true };
}

/** 验证成功后清零，避免正常的连续登录把自己锁住 */
export async function resetRateLimit(key: string): Promise<void> {
  const col = (await getDb()).collection<LimitDoc>("rate_limits");
  await col.deleteOne({ _id: key });
}

/** Vercel 会把真实 IP 放在 x-forwarded-for 的第一段 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}
