// 站内统一页脚：未登录显示"登录"，登录后换成"退出登录"
import { isLoggedIn } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";

export default async function SiteFooter() {
  const t = await getT();
  const [loggedIn, settings] = await Promise.all([
    isLoggedIn(),
    getSettings().catch(() => null),
  ]);

  // 页脚文字：设置页填了就用它，没填用默认的版权年份。
  // 填的是完整的一段（想带年份就自己写上），这样「用 inslog 写的」
  // 这种话也能直接放进去，不会被硬套一个格式。
  const footerText = settings?.footerText?.trim();

  return (
    <footer className="site-foot">
      <a href="/">{t("首页")}</a> · {footerText || "© 2026"}{" "}
      <a href="https://github.com/daveswong/inslog">inslog on GitHub</a>
      {loggedIn ? (
        <>
          {" · "}
          <a href="/settings">{t("设置")}</a>
          {" · "}
          <form className="foot-logout" action="/api/auth/logout" method="post">
            <button className="foot-link" type="submit">
              {t("退出登录")}
            </button>
          </form>
        </>
      ) : (
        <>
          {" · "}
          <a href="/login">{t("登录")}</a>
        </>
      )}
    </footer>
  );
}
