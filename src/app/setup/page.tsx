// 首次安装向导：配置服务器的运行环境变量，配齐即安装完成
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { isDbConfigured } from "@/lib/mongodb";
import { canWriteEnvFile, isVercel } from "@/lib/env-config";
import { canWriteSettingsFile } from "@/lib/settings-file";
import SetupWizard from "./setup-wizard";
import { getSetupData } from "./setup-data";
import { listPasskeys } from "@/lib/passkey";
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

  const {
    recoveryReady,
    rpId,
    origin,
    requestHost,
    rpIdMatchesHost,
    originHost,
    dbStatus,
    dbConfigured,
    serviceFeatures,
    manualAuthItems,
    generatedAuthItems,
  } = await getSetupData();

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{t("首次安装")}</h1>
        <p className="site-desc">
          {t("配置服务器的运行环境变量。")}
        </p>
      </header>

      <SetupWizard
        authItems={manualAuthItems}
        generatedAuthItems={generatedAuthItems}
        serviceFeatures={serviceFeatures}
        envWritable={canWriteEnvFile()}
        fileWritable={canWriteSettingsFile()}
        onVercel={isVercel()}
        dbStatus={dbStatus}
        dbConfigured={dbConfigured}
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
