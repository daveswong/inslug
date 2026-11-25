// 站内统一页脚：未登录显示"登录"，登录后换成"退出登录"
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export default async function SiteFooter() {
  const t = await getT();
  const loggedIn = await isLoggedIn();

  return (
    <footer className="site-foot">
      <a href="/">{t("首页")}</a> · © 2026{" "}
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
