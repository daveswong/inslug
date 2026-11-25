"use server";

// 站点设置的保存：只处理站点展示信息，不碰任何数据库连接配置
import { isLoggedIn } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";

export type SettingsState = { status: "idle" | "ok" | "error"; message: string };

/**
 * 保存站点设置的某一组。
 *
 * 设置页按折叠面板分了组，每组一个独立表单、带自己的保存按钮，
 * 所以这里只更新表单里出现的那几个字段，不会把别的组覆盖掉。
 * 分组名由表单里的隐藏字段 __group 带来。
 */
export async function saveSiteSettings(
  _prev: SettingsState,
  form: FormData
): Promise<SettingsState> {
  const t = await getT();
  // 中间件已经拦过一次，这里再校验一遍（纵深防御）
  if (!(await isLoggedIn())) {
    return { status: "error", message: t("登录已过期，请重新登录后再试") };
  }

  const group = String(form.get("__group") ?? "").trim();
  const value = (key: string) => String(form.get(key) ?? "").trim();

  try {
    if (group === "basic") {
      const siteName = value("siteName");
      if (!siteName) return { status: "error", message: t("站点名不能为空") };
      await saveSettings({
        siteName,
        description: value("description"),
        author: value("author"),
        favicon: value("favicon"),
        ogImage: value("ogImage"),
      });
    } else if (group === "list") {
      const perPage = Number(value("postsPerPage"));
      const postsPerPage = Number.isFinite(perPage)
        ? Math.min(50, Math.max(1, Math.round(perPage)))
        : 20;
      await saveSettings({ postsPerPage, footerText: value("footerText") });
    } else if (group === "seo") {
      await saveSettings({
        seoTitle: value("seoTitle"),
        seoDescription: value("seoDescription"),
        seoKeywords: value("seoKeywords"),
      });
    } else if (group === "notify") {
      await saveSettings({ notifyEmail: value("notifyEmail") });
    } else if (group === "social") {
      await saveSettings({
        social: {
          github: value("github"),
          x: value("x"),
          email: value("email"),
        },
      });
    } else {
      return { status: "error", message: t("保存失败：未知的分组") };
    }
    return { status: "ok", message: t("已保存") };
  } catch {
    return { status: "error", message: t("保存失败：数据库连接异常") };
  }
}
