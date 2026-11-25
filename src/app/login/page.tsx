// 登录页：主用 Passkey，后备密码；已登录则只给入口，管理 Passkey 去设置页
import { isLoggedIn } from "@/lib/auth";
import SiteFooter from "@/components/SiteFooter";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const loggedIn = await isLoggedIn();

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">
          <a href="/">登录</a>
        </h1>
        <p className="site-desc">只有这里需要身份：写文章和站点设置。</p>
      </header>

      <LoginForm loggedIn={loggedIn} next={next ?? "/"} />

      <SiteFooter />
    </main>
  );
}
