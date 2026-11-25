// 站点设置：按折叠面板分组，每组独立保存
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SettingsAccordion from "@/components/settings-accordion";
import { isLoggedIn } from "@/lib/auth";
import { getAuth, passkeyAddAllowed } from "@/lib/credentials";
import { listPasskeys } from "@/lib/passkey";
import { getSettings } from "@/lib/settings";
import { mailReady } from "@/lib/change-request";
import PasskeyManager from "./passkey-manager";
import TotpManager from "./totp-manager";
import LanguageSelect from "./language-select";
import ServiceConfig from "./service-config";
import {
  BasicForm,
  ListForm,
  NotifyForm,
  SeoForm,
  SocialForm,
} from "./site-form";
import ThemeToggle from "./theme-toggle";
import { getT } from "@/lib/i18n";
import { buildServiceFeatures } from "@/lib/service-features";

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
  const serviceFeatures = await buildServiceFeatures(t);
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

      <SettingsAccordion
        defaultOpen={["basic"]}
        items={[
          {
            id: "basic",
            title: t("基本信息"),
            summary: settings.siteName,
            children: <BasicForm settings={settings} />,
          },
          {
            id: "list",
            title: t("列表与页脚"),
            summary: t("每页 {n} 篇", { n: String(settings.postsPerPage) }),
            children: <ListForm settings={settings} />,
          },
          {
            id: "seo",
            title: t("SEO"),
            summary: settings.seoTitle || settings.siteName,
            children: <SeoForm settings={settings} />,
          },
          {
            id: "notify",
            title: t("通知"),
            summary: settings.notifyEmail || t("未设置"),
            children: <NotifyForm settings={settings} />,
          },
          {
            id: "social",
            title: t("社交链接"),
            children: <SocialForm settings={settings} />,
          },
          {
            id: "appearance",
            title: t("外观"),
            summary: settings.uiLanguage === "en" ? "English" : "中文",
            children: (
              <>
                <h3 className="form-group">{t("主题")}</h3>
                <p className="notice">
                  {t("默认跟随系统；想固定浅色或深色就在这里选。")}
                </p>
                <ThemeToggle />

                <h3 className="form-group">{t("界面语言")}</h3>
                <p className="notice">
                  {t(
                    "只影响界面文字，文章内容不翻译；切换后立即生效，全站一起变。"
                  )}
                </p>
                <LanguageSelect value={settings.uiLanguage ?? ""} />
              </>
            ),
          },
          {
            id: "service",
            title: t("邮件与图片存储"),
            summary: serviceFeatures
              .flatMap((feature) => feature.fields)
              .every((field) => field.configured)
              ? t("都已配置")
              : t("有未配置的项"),
            children: (
              <>
                <p className="notice">
                  {t(
                    "这两项存在数据库里，部署之后随时可以在这里改，不用重新部署。"
                  )}
                </p>
                <ServiceConfig features={serviceFeatures} />
              </>
            ),
          },
          {
            id: "login",
            title: t("登录"),
            summary: t("Passkey {n} 把", { n: String(passkeys.length) }),
            children: (
              <>
                <h3 className="form-group">Passkey</h3>
                <p className="notice">
                  {t(
                    "Passkey 绑好之后，登录不用输任何东西，用 Touch ID / 指纹一按就行。 换设备重新绑一把即可。"
                  )}
                </p>
                <PasskeyManager
                  passkeys={passkeys}
                  authorized={authorized}
                  mailReady={canMail}
                />

                <h3 className="form-group">{t("手机验证器")}</h3>
                <p className="notice">
                  {t(
                    "验证器是 Passkey 之外的另一把钥匙：手机上的 1Password、Google Authenticator、 iOS 密码 App 都行，扫个码绑上，以后输 6 位数字就能登录。"
                  )}
                </p>
                <TotpManager bound={bound} mailReady={canMail} />

                <p className="notice">
                  <a href="/reset">{t("两把钥匙都丢了？看恢复指引")}</a>
                </p>
              </>
            ),
          },
        ]}
      />

      <SiteFooter />
    </main>
  );
}
