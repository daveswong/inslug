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

  // 1) 先确保这条记录存在（只在没有时插入，不动已有的）
  await col.updateOne(
    { _id: key },
    { $setOnInsert: { count: 0, resetAt: now + windowMs } },
    { upsert: true }
  );

  // 2) 窗口过期的才重置。注意这一步不能带 upsert：
  //    窗口没过时这条记录已经存在，带 upsert 会去插一条同 _id 的新记录然后撞重复键。
  await col.updateOne(
    { _id: key, resetAt: { $lte: now } },
    { $set: { count: 0, resetAt: now + windowMs } }
  );

  // 3) 计数用 $inc 原子自增，而不是「读出来 +1 再写回去」——
  //    后者在并发下会丢计数：几个请求同时读到同一个旧值，
  //    都判定「没超限」，然后一起把计数写成同一个数，限制就形同虚设。
  const after = await col.findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 } },
    { returnDocument: "after" }
  );

  const count = after?.count ?? 1;
  const resetAt = after?.resetAt ?? now + windowMs;

  if (count > max) {
    return {
      allowed: false,
      minutes: Math.max(1, Math.ceil((resetAt - now) / 60000)),
    };
  }
  return { allowed: true };
}

/** 验证成功后清零，避免正常的连续登录把自己锁住 */
export async function resetRateLimit(key: string): Promise<void> {
  const col = (await getDb()).collection<LimitDoc>("rate_limits");
  await col.deleteOne({ _id: key });
}

/**
 * 取真实客户端 IP。
 *
 * Vercel 会把真实 IP 放在 x-forwarded-for 的第一段；
 * 但自部署用 nginx 默认配置时，第一段是客户端可以随便填的——
 * 拿它当限速键的话，攻击者每请求换一个值就等于无限次尝试。
 *
 * 所以这里的键只用「自己控制得住」的部分：
 * 有 Vercel 的标识就用 Vercel 给的 IP，否则用连接来源地址。
 */
export function clientKey(req: Request): string {
  if (process.env.VERCEL) {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim();
    if (ip) return ip;
    return req.headers.get("x-real-ip")?.trim() || "vercel";
  }
  // 自部署：Host 头同样能被伪造，不能拿来当键。
  // 只能用连接本身的来源地址——Vercel 之外拿不到可靠的真实 IP，
  // 所以这里的限速按「所有来访共用一个桶」算，偏严但不会被绕过。
  const host = req.headers.get("host") ?? "local";
  return `host:${host}`;
}
