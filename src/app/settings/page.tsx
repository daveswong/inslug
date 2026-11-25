// 站点设置：站点展示信息 + 登录方式（Passkey / 手机验证器）
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getAuth, passkeyAddAllowed } from "@/lib/credentials";
import { listPasskeys } from "@/lib/passkey";
import { getSettings } from "@/lib/settings";
import { mailReady } from "@/lib/change-request";
import PasskeyManager from "./passkey-manager";
import TotpManager from "./totp-manager";
import LanguageSelect from "./language-select";
import SiteForm from "./site-form";
import ThemeToggle from "./theme-toggle";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getT();
  // middleware 只验签名，会话版本失效（换过验证器）的旧 cookie 要在这里挡掉
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

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{t("站点设置")}</h1>
        {!settings.setupCompleted && (
          <p className="notice">
            <a href="/setup">{t("初始化还没走完，去安装向导")}</a>
          </p>
        )}
      </header>

      <section className="section">
        <h2 className="section-title">{t("站点信息")}</h2>
        <SiteForm settings={settings} />
      </section>

      <section className="section">
        <h2 className="section-title">{t("外观")}</h2>
        <p className="notice">{t("默认跟随系统；想固定浅色或深色就在这里选。")}</p>
        <ThemeToggle />

        <h3 className="form-group">{t("界面语言")}</h3>
        <p className="notice">{t("只影响界面文字，文章内容不翻译。")}</p>
        <LanguageSelect value={settings.uiLanguage ?? ""} />
      </section>

      <section className="section">
        <h2 className="section-title">{t("登录")}</h2>
        <p className="notice">
          
          {t("Passkey 绑好之后，登录不用输任何东西，用 Touch ID / 指纹一按就行。 换设备重新绑一把即可。")}
        </p>
        <PasskeyManager
          passkeys={passkeys}
          authorized={authorized}
          mailReady={canMail}
        />

        <h3 className="form-group">{t("手机验证器")}</h3>
        <p className="notice">
          
          {t("验证器是 Passkey 之外的另一把钥匙：手机上的 1Password、Google Authenticator、 iOS 密码 App 都行，扫个码绑上，以后输 6 位数字就能登录。")}
        </p>
        <TotpManager bound={bound} mailReady={canMail} />

        <p className="notice"><a href="/reset">{t("两把钥匙都丢了？看恢复指引")}</a></p>
      </section>

      <SiteFooter />
    </main>
  );
}
