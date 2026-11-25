// 登录页：Passkey 或手机验证器；两把钥匙都丢了才用紧急入口（?recovery=1）
import { isLoggedIn } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SiteFooter from "@/components/SiteFooter";
import LoginForm from "./login-form";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ next?: string; recovery?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const t = await getT();
  const { next, recovery } = await searchParams;
  const loggedIn = await isLoggedIn();
  const settings = await getSettings();

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">
          <a href="/">{t("登录")}</a>
        </h1>
        <p className="site-desc">{t("只有这里需要身份：写文章和站点设置。")}</p>
        <p className="notice"><a href="/reset">{t("进不去？看恢复指引")}</a></p>
      </header>

      <LoginForm
        loggedIn={loggedIn}
        next={next ?? "/"}
        recovery={recovery === "1" || !settings.setupCompleted}
        needsSetup={!settings.setupCompleted}
      />

      <SiteFooter />
    </main>
  );
}
