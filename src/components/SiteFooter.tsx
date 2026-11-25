// 站内统一页脚：未登录显示"登录"，登录后换成"退出登录"
import { isLoggedIn } from "@/lib/auth";

export default async function SiteFooter() {
  const loggedIn = await isLoggedIn();

  return (
    <footer className="site-foot">
      <a href="/">首页</a> · © 2026 <a href="#">inslog on GitHub</a>
      {loggedIn ? (
        <>
          {" · "}
          <a href="/settings">设置</a>
          {" · "}
          <form className="foot-logout" action="/api/auth/logout" method="post">
            <button className="foot-link" type="submit">
              退出登录
            </button>
          </form>
        </>
      ) : (
        <>
          {" · "}
          <a href="/login">登录</a>
        </>
      )}
    </footer>
  );
}
