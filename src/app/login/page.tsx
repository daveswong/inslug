// 登录页：Passkey 或手机验证器；两把钥匙都没绑时直接显示紧急入口
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { getEnvValue } from "@/lib/env-config";
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
  // 未配置或被删除时，紧急页只提示去设置，不报错、不跳安装。
  const recoveryReady = (getEnvValue("RECOVERY_TOKEN") ?? "").length >= 16;

  // 每种登录方式各自是否可用；没配置的那个在表单里直接禁用。
  // 查不到凭据状态时按「已绑定」处理——避免抖动误把入口禁用。
  let passkeyReady = true;
  let totpReady = true;
  try {
    const [keys, auth] = await Promise.all([listPasskeys(), getAuth()]);
    passkeyReady = keys.length > 0;
    totpReady = auth.totpBound;
  } catch {
    passkeyReady = true;
    totpReady = true;
  }
  // 两把钥匙都没绑时（比如刚装完），直接把紧急入口摆出来。
  const noKeysBound = !passkeyReady && !totpReady;
  const showRecovery =
    recovery === "1" || noKeysBound || !settings.setupCompleted;

  return (
    <main className="site mx-auto">
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
        {!showRecovery && (
          <p className="notice">
            {t("进不去就用紧急密钥：")}<a href="/login?recovery=1">{t("从这里登录")}</a>
          </p>
        )}
      </header>

      <LoginForm
        loggedIn={loggedIn}
        next={next ?? "/"}
        recovery={showRecovery}
        passkeyReady={passkeyReady}
        totpReady={totpReady}
        recoveryReady={recoveryReady}
        needsSetup={!settings.setupCompleted}
      />

      <SiteFooter />
    </main>
  );
}
