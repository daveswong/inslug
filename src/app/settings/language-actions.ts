"use server";

// 设置页切换界面语言：存进数据库的 settings.uiLanguage，改完立刻生效
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n-core";
import { saveSettings } from "@/lib/settings";

export async function saveLanguage(
  locale: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return { ok: false, error: t("登录已过期，请重新登录") };
  }

  const value = String(locale ?? "").trim();
  if (value && !SUPPORTED_LOCALES.includes(value as Locale)) {
    return { ok: false, error: t("不支持的语言") };
  }

  try {
    await saveSettings({ uiLanguage: value });
  } catch {
    return { ok: false, error: t("保存失败：数据库连接异常") };
  }
  return { ok: true };
}
