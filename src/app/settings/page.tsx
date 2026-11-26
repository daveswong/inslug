// 站点设置：四组平铺，一个保存按钮
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getAuth, passkeyAddAllowed } from "@/lib/credentials";
import { listPasskeys } from "@/lib/passkey";
import { getSettings, settingsStore } from "@/lib/settings";
import { mailReady } from "@/lib/change-request";
import PasskeyManager from "./passkey-manager";
import TotpManager from "./totp-manager";
import LanguageSelect from "./language-select";
import SettingsForm from "./site-form";
import ThemeToggle from "./theme-toggle";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getT();
  // proxy.ts 只粗筛 cookie，会话版本失效（换过验证器）的旧 cookie 要在这里挡掉
  if (!(await isLoggedIn())) redirect("/login?next=%2Fsettings");

  const settings = await getSettings();
  let bound = false;
  try {
    bound = !!(await getAuth()).totpSecret;
  } catch {
    bound = false;
  }
  const canMail = await mailReady().catch(() => false);
  const [keyDocs, authorized] = await Promise.all([
    listPasskeys().catch(() => []),
    passkeyAddAllowed().catch(() => false),
  ]);
  const passkeys = keyDocs.map((key) => ({
    credentialId: key.credentialId,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    transports: key.transports ?? [],
  }));

  const appearanceExtras = (
    <>
      <h3 className="form-group">{t("主题")}</h3>
      <ThemeToggle />
      <h3 className="form-group">{t("界面语言")}</h3>
      <LanguageSelect value={settings.uiLanguage ?? ""} />
    </>
  );

  const securityExtras = (
    <>
      <h3 className="form-group">Passkey</h3>
      <PasskeyManager passkeys={passkeys} authorized={authorized} mailReady={canMail} />
      <h3 className="form-group">{t("手机验证器")}</h3>
      <TotpManager bound={bound} mailReady={canMail} />
      <p className="notice">
        <a href="/reset">{t("两把钥匙都丢了？看恢复指引")}</a>
      </p>
    </>
  );

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{t("站点设置")}</h1>
        <p className="notice">
          {settingsStore() === "file"
            ? t("站点设置存在服务器上的 config/settings.json。")
            : t("站点设置存在数据库里。")}
        </p>
        {!settings.setupCompleted && (
          <p className="notice">
            <a href="/setup">{t("初始化还没走完，去安装向导")}</a>
          </p>
        )}
      </header>

      <SettingsForm
        settings={settings}
        appearanceExtras={appearanceExtras}
        securityExtras={securityExtras}
      />

      <SiteFooter />
    </main>
  );
}
