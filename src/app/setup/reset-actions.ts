"use server";

// 恢复页：发起「重置身份验证与启动配置」的申请，只发确认邮件，不动任何东西
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { requestConfigReset } from "@/lib/change-request";
import { getEnvValue } from "@/lib/env-config";

export async function requestConfigResetAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return { ok: false, error: t("登录已过期，请重新登录") };
  }

  const headersList = await import("next/headers");
  const h = await headersList.headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin =
    getEnvValue("ORIGIN") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${forwardedHost}`;
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "未知";
  const ua = h.get("user-agent") ?? "";

  const result = await requestConfigReset({
    linkOrigin: origin,
    ip,
    ua,
  });
  if ("error" in result) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}
