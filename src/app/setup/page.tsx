// 首次安装向导：先配服务器的运行环境变量，再配站点信息和两把钥匙
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getAuth, passkeyAddAllowed } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { listPasskeys } from "@/lib/passkey";
import { mailReady } from "@/lib/change-request";
import { ensureDatabase, isDbConfigured, type DatabaseStatus } from "@/lib/mongodb";
import { canWriteEnvFile, getEnvValue, isVercel } from "@/lib/env-config";
import { canWriteSettingsFile } from "@/lib/settings-file";
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
  // 库名对应的库：存在就接着用，不存在就建一个（初始化时该做的事）
  let dbStatus: DatabaseStatus | null = null;
  if (dbOk) {
    try {
      dbStatus = await ensureDatabase();
    } catch {
      dbStatus = null;
    }
  }
  const configStepOpen = !hasAny;

  // 数据库连得上、但读凭据失败（权限不足之类）：这时不能免登录，
  // 否则等于把密钥改写入口敞开。给站长一句说明，别让人以为页面坏了。
  let credentialProbeFailed = false;
  if (dbOk && hasAny) {
    try {
      await listPasskeys();
    } catch {
      credentialProbeFailed = true;
    }
  }

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
    hasTotp = (await getAuth()).totpBound;
  } catch {
    hasTotp = false;
  }
  const canMail = await mailReady().catch(() => false);

  // 服务器上有没有 RECOVERY_TOKEN：紧急登录入口开不开，全看这个。
  // Vercel 上 .env 是下载到本地的，导入环境变量并重新部署之后这里才会变成 true。
  const recoveryReady = (getEnvValue("RECOVERY_TOKEN") ?? "").length >= 16;

  // Passkey 的域名配置对不对得上当前这个站点。
  // 浏览器只说「The RP ID "x" is invalid for this domain」，不说是哪个域名不对，
  // 所以这里把服务器读到的值和当前请求的主机名都摆出来。
  const headersList = await import("next/headers");
  const h = await headersList.headers();
  const requestHost = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();
  const rpId = getEnvValue("RP_ID") ?? "";
  const origin = getEnvValue("ORIGIN") ?? "";
  const rpIdLower = rpId.trim().toLowerCase();
  // 浏览器的要求：RP ID 要等于当前域名，或是它的可注册域后缀。
  const rpIdMatchesHost =
    !!requestHost &&
    !!rpIdLower &&
    (requestHost === rpIdLower || requestHost.endsWith(`.${rpIdLower}`));
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).hostname.toLowerCase() : "";
  } catch {
    originHost = "";
  }

  const serviceFeatures = await buildServiceFeatures(t);

  const authItems = AUTH_KEYS.map((item) => ({
    key: item.key,
    label: t(item.label),
    hint: t(item.hint),
    secret: item.secret,
    configured: Boolean(getEnvValue(item.key)),
    generated: Boolean(item.generated),
    options: item.options?.map((option) => ({
      value: option.value,
      label: t(option.label),
    })),
    value: getEnvValue(item.key) ?? "",
  }));
  // 手填的：数据库地址、库名、域名这些
  const manualAuthItems = authItems.filter((item) => !item.generated);
  // 程序生成的：会话密钥、紧急密钥
  const generatedAuthItems = authItems.filter((item) => item.generated);

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{t("首次安装")}</h1>
        <p className="site-desc">
          {t("配置服务器、站点与登录方式。")}
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
        authItems={manualAuthItems}
        generatedAuthItems={generatedAuthItems}
        serviceFeatures={serviceFeatures}
        envWritable={canWriteEnvFile()}
        fileWritable={canWriteSettingsFile()}
        onVercel={isVercel()}
        loggedIn={loggedIn}
        dbStatus={dbStatus}
        recoveryReady={recoveryReady}
        rpId={rpId}
        origin={origin}
        requestHost={requestHost}
        rpIdMatchesHost={rpIdMatchesHost}
        originHost={originHost}
        credentialProbeFailed={credentialProbeFailed}
      />

      <SiteFooter />
    </main>
  );
}
