"use server";

/**
 * 恢复页生成临时密钥：只返回一串随机数，不写 .env、不写数据库、不碰当前配置。
 * 拥有者得自己把它填进服务器的 .env 或 Vercel 环境变量才会生效——
 * 这道"必须能碰服务器"的门槛就是安全边界。
 *
 * 限速用落库的 rate_limits（和登录接口同一套），拦的是无意义地反复点按钮。
 * 数据库连不上时限速降级放行：恢复场景本身就可能库不可用，不能因此把生成也堵死。
 */
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { getT } from "@/lib/i18n";

export async function generateRecoveryToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const t = await getT();
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const gate = await rateLimit(`recovery-gen:${ip}`, 5, 10 * 60 * 1000);
    if (!gate.allowed) {
      return {
        ok: false,
        error: t("尝试次数过多，请 {n} 分钟后再试", { n: gate.minutes }),
      };
    }
  } catch {
    // 数据库不可用：跳过限速，保证恢复通道始终可用
  }

  try {
    return { ok: true, token: randomBytes(32).toString("base64") };
  } catch {
    return { ok: false, error: t("生成失败，请重试") };
  }
}
