// 首次安装向导：先配服务器的运行环境变量，再配站点信息和两把钥匙
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getAuth, passkeyAddAllowed } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { listPasskeys } from "@/lib/passkey";
import { mailReady } from "@/lib/change-request";
import { isDbConfigured } from "@/lib/mongodb";
import { canWriteEnvFile, getEnvValue, isVercel } from "@/lib/env-config";
import { buildServiceFeatures } from "@/lib/service-features";
import { AUTH_KEYS } from "@/lib/config-keys";
import SetupWizard from "./setup-wizard";
import { hasCredentials } from "./config-actions";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const t = await getT();
  const loggedIn = await isLoggedIn();

  // 站点上还没有任何登录凭据时，第 1 步（服务器配置）必须能免登录打开：
  // 新部署可能连数据库都还没配，这时候除了这一步没有别的入口。
  const dbOk = await isDbConfigured();
  const hasAny = dbOk ? await hasCredentials() : false;
  const configStepOpen = !hasAny;

  if (!loggedIn && !configStepOpen) {
    redirect("/login?next=%2Fsetup");
  }

  const settings = await getSettings();
  const [keyDocs, authorized] = await Promise.all([
    listPasskeys().catch(() => []),
    passkeyAddAllowed().catch(() => false),
  ]);
  const passkeyCount = keyDocs.length;
  const passkeys = keyDocs.map((key) => ({
    credentialId: key.credentialId,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    transports: key.transports ?? [],
  }));

  let hasTotp = false;
  try {
    hasTotp = !!(await getAuth()).totpSecret;
  } catch {
    hasTotp = false;
  }
  const canMail = await mailReady().catch(() => false);

  const serviceFeatures = await buildServiceFeatures(t);

  const authItems = AUTH_KEYS.map((item) => ({
    key: item.key,
    label: t(item.label),
    hint: t(item.hint),
    secret: item.secret,
    configured: Boolean(getEnvValue(item.key)),
  }));

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{t("首次安装")}</h1>
        <p className="site-desc">
          {t("先配服务器的运行环境变量，再配站点和登录方式。")}
        </p>
      </header>

      <SetupWizard
        initial={{
          siteName: settings.siteName,
          description: settings.description,
          notifyEmail: settings.notifyEmail,
          postsPerPage: settings.postsPerPage,
        }}
        passkeyCount={passkeyCount}
        passkeys={passkeys}
        authorized={authorized}
        hasTotp={hasTotp}
        mailReady={canMail}
        completed={settings.setupCompleted}
        authItems={authItems}
        serviceFeatures={serviceFeatures}
        envWritable={canWriteEnvFile()}
        onVercel={isVercel()}
        loggedIn={loggedIn}
        dbOk={dbOk}
      />

      <SiteFooter />
    </main>
  );
}
