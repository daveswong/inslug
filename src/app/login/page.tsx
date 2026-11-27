// 登录页：Passkey 或手机验证器；两把钥匙都没绑时直接显示紧急入口
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { listPasskeys } from "@/lib/passkey";
import SiteFooter from "@/components/SiteFooter";
import LoginForm from "./login-form";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ next?: string; recovery?: string; welcome?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const t = await getT();
  const { next, recovery, welcome } = await searchParams;
  const loggedIn = await isLoggedIn();
  const settings = await getSettings();

  // 没绑任何钥匙时（比如刚装完），直接把紧急入口摆出来，省得用户再去找入口。
  // 查不到凭据状态时按「有钥匙」处理——不额外放开紧急入口，避免抖动误判。
  let noKeysBound = false;
  try {
    const [keys, auth] = await Promise.all([listPasskeys(), getAuth()]);
    noKeysBound = keys.length === 0 && !auth.totpBound;
  } catch {
    noKeysBound = false;
  }

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">
          <a href="/">{t("登录")}</a>
        </h1>
        <p className="site-desc">{t("只有这里需要身份：写文章和站点设置。")}</p>
        {welcome === "1" && (
          <p className="notice">
            {t(
              "安装完成。请用 .env 里的 RECOVERY_TOKEN 登录，然后到站点设置里配置通知邮箱和身份验证（Passkey、验证器）。"
            )}
          </p>
        )}
        <p className="notice">
          {t("进不去就用紧急密钥：")}<a href="/login?recovery=1">{t("从这里登录")}</a>
        </p>
      </header>

      <LoginForm
        loggedIn={loggedIn}
        next={next ?? "/"}
        recovery={recovery === "1" || noKeysBound || !settings.setupCompleted}
        needsSetup={!settings.setupCompleted}
      />

      <SiteFooter />
    </main>
  );
}
