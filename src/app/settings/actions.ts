"use server";

// 站点设置的保存：只处理站点展示信息，不碰任何数据库连接配置
import { isLoggedIn } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import type { SocialLink } from "@/lib/types";
import { getT } from "@/lib/i18n";

export type SettingsState = { status: "idle" | "ok" | "error"; message: string };

/**
 * 保存站点设置。前端只提交改过的字段，没出现的字段原样不动。
 * 登录校验在这里再做一遍（纵深防御），不依赖 proxy 的粗筛。
 */
export async function saveSiteSettings(
  _prev: SettingsState,
  form: FormData
): Promise<SettingsState> {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return { status: "error", message: t("登录已过期，请重新登录后再试") };
  }

  const has = (key: string) => form.has(key);
  const value = (key: string) => String(form.get(key) ?? "").trim();
  const changes: Record<string, unknown> = {};

  try {
    if (has("siteName")) {
      const siteName = value("siteName");
      if (!siteName) return { status: "error", message: t("站点名不能为空") };
      changes.siteName = siteName;
    }
    const textKeys = [
      "description", "author", "footerText", "seoTitle",
      "seoDescription", "seoKeywords", "notifyEmail", "favicon", "ogImage",
    ] as const;
    for (const key of textKeys) {
      if (has(key)) changes[key] = value(key);
    }
    if (has("postsPerPage")) {
      const num = Number(value("postsPerPage"));
      changes.postsPerPage = Number.isFinite(num)
        ? Math.min(50, Math.max(1, Math.round(num)))
        : 20;
    }
    if (has("social")) {
      let links: unknown;
      try {
        links = JSON.parse(value("social"));
      } catch {
        return { status: "error", message: t("社交链接格式不对") };
      }
      if (!Array.isArray(links)) {
        return { status: "error", message: t("社交链接格式不对") };
      }
      const clean: SocialLink[] = links
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object")
        )
        .map((item) => ({
          title: String(item.title ?? "").trim(),
          url: String(item.url ?? "").trim(),
        }))
        .filter((item) => item.title && item.url);
      changes.social = clean;
    }

    if (Object.keys(changes).length === 0) return { status: "idle", message: "" };
    await saveSettings(changes);
    return { status: "ok", message: t("已保存") };
  } catch {
    return { status: "error", message: t("保存失败：数据库连接异常") };
  }
}
