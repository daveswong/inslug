"use server";

// 站点设置的保存：只处理站点展示信息，不碰任何数据库连接配置
import { isLoggedIn } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";

export type SettingsState = { status: "idle" | "ok" | "error"; message: string };

export async function saveSiteSettings(
  _prev: SettingsState,
  form: FormData
): Promise<SettingsState> {
  const t = await getT();
  // 中间件已经拦过一次，这里再校验一遍（纵深防御）
  if (!(await isLoggedIn())) {
    return { status: "error", message: t("登录已过期，请重新登录后再试") };
  }

  const value = (key: string) => String(form.get(key) ?? "").trim();

  const siteName = value("siteName");
  if (!siteName) return { status: "error", message: t("站点名不能为空") };

  const perPage = Number(value("postsPerPage"));
  const postsPerPage = Number.isFinite(perPage)
    ? Math.min(50, Math.max(1, Math.round(perPage)))
    : 20;

  try {
    await saveSettings({
      siteName,
      description: value("description"),
      author: value("author"),
      seoTitle: value("seoTitle"),
      seoDescription: value("seoDescription"),
      seoKeywords: value("seoKeywords"),
      social: {
        github: value("github"),
        x: value("x"),
        email: value("email"),
      },
      favicon: value("favicon"),
      ogImage: value("ogImage"),
      footerText: value("footerText"),
      postsPerPage,
      notifyEmail: value("notifyEmail"),
    });
    return { status: "ok", message: t("已保存") };
  } catch {
    return { status: "error", message: t("保存失败：数据库连接异常") };
  }
}
