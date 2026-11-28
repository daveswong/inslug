// 站点设置：四组平铺，一个保存按钮
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getAuth, passkeyAddAllowed } from "@/lib/credentials";
import { listPasskeys } from "@/lib/passkey";
import { getSettings, settingsFileIssue, settingsStore } from "@/lib/settings";
import { getStorageProvider } from "@/lib/storage";
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
  // 配置文件坏了：页面显示的是默认值，得明确告诉站长，
  // 否则他只会觉得「站点名怎么变了」，找不到原因
  const fileIssue = settingsFileIssue();
  let bound = false;
  try {
    bound = (await getAuth()).totpBound;
  } catch {
    bound = false;
  }
  const canMail = await mailReady().catch(() => false);
  // 图片上传要按当前存储方案分派，favicon / 分享图的上传也得走同一条路
  const storageProvider = await getStorageProvider();
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
    </>
  );

  return (
    <main className="site mx-auto">
      <header className="site-head">
        <h1 className="site-title">{t("站点设置")}</h1>
        {fileIssue && (
          <p className="form-error">
            {t("配置文件读取失败，当前显示的是默认值。")} {fileIssue}
          </p>
        )}
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
        storageProvider={storageProvider}
      />

      <SiteFooter />
    </main>
  );
}
