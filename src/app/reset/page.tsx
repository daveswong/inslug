// 恢复指引：未登录只给通用步骤（不泄露状态）；登录后按实际状态给出针对性步骤
import SiteFooter from "@/components/SiteFooter";
import ResetConfigButton from "./reset-config-button";
import RecoveryTokenPanel from "./recovery-token-panel";
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { getSettings, settingsStore } from "@/lib/settings";
import { listPasskeys } from "@/lib/passkey";
import { mailReady } from "@/lib/change-request";
import { canWriteEnvFile, getEnvValue, isVercel } from "@/lib/env-config";
import { canWriteSettingsFile } from "@/lib/settings-file";
import { CONFIG_KEYS } from "@/lib/config-keys";
import { getT } from "@/lib/i18n";
import SetupWizard from "@/app/setup/setup-wizard";
import { getSetupData } from "@/app/setup/setup-data";

export const dynamic = "force-dynamic";

export default async function ResetPage() {
  const t = await getT();
  const loggedIn = await isLoggedIn();

  if (!loggedIn) {
    return (
      <main className="site">
        <header className="site-head">
          <h1 className="site-title">{t("恢复指引")}</h1>
          <p className="site-desc">{t("下面是通用步骤。登录后打开这一页，会直接按你的实际状态列。")}</p>
        </header>

        <section className="section">
          <ol className="reset-steps">
            <li>
              {t("Passkey 还在手上：直接")}<a href="/login">{t("登录")}</a>{t("。")}
            </li>
            <li>
              {t("只有手机验证器在手：在")}<a href="/login">{t("登录页")}</a>{t("输 6 位码。")}
            </li>
            <li>
              {t("两把钥匙都不在手：用下面的按钮生成一把临时密钥。")}
            </li>
          </ol>

          <RecoveryTokenPanel />

          <ol className="reset-steps" start={4}>
            <li>
              {t("把它填进服务端：Vercel 在 Settings → Environment Variables 加一条")}
              <code> RECOVERY_TOKEN </code>{t("；自部署写入项目根目录的")}
              <code> .env </code>{t("。然后重新部署或重启。")}
            </li>
            <li>
              {t("生效后打开")}<a href="/login?recovery=1">{t("紧急登录")}</a>{t("，粘贴密钥进去。")}
            </li>
          </ol>
          <p className="notice">
            {t("进去后立刻重新绑定 Passkey 和验证器。")}
          </p>
        </section>

        <SiteFooter />
      </main>
    );
  }

  // 恢复流程和首次安装走同一套向导：第一步都是配环境变量，
  // 然后确认数据库、确认邮箱、绑两把钥匙。所以数据也共用一份。
  const {
    settings,
    passkeys,
    passkeyCount,
    authorized,
    hasTotp,
    mailReady: canMail,
    recoveryReady: hasRecovery,
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
  const canWriteEnv = canWriteEnvFile();

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{t("恢复指引")}</h1>
        <p className="site-desc">{t("当前状态与下一步。只显示配置是否存在，不显示任何密钥内容。")}</p>
      </header>

      <section className="section">
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
          initialEmailConfirmed={settings.notifyEmail.trim().length > 0}
          mailReady={canMail}
          completed={settings.setupCompleted}
          authItems={manualAuthItems}
          generatedAuthItems={generatedAuthItems}
          serviceFeatures={serviceFeatures}
          envWritable={canWriteEnv}
          fileWritable={canWriteSettingsFile()}
          onVercel={isVercel()}
          loggedIn={loggedIn}
          dbStatus={dbStatus}
          dbConfigured={dbConfigured}
          recoveryReady={hasRecovery}
          rpId={rpId}
          origin={origin}
          requestHost={requestHost}
          rpIdMatchesHost={rpIdMatchesHost}
          originHost={originHost}
          credentialProbeFailed={false}
        />
      </section>

      <section className="section">
        <h2 className="section-title">{t("当前状态")}</h2>
        <dl className="confirm-meta">
          <dt>Passkey</dt>
          <dd>{passkeyCount > 0 ? t("已绑定 {n} 把", { n: passkeyCount }) : t("没有绑定")}</dd>
          <dt>{t("手机验证器")}</dt>
          <dd>{hasTotp ? t("已绑定") : t("未绑定")}</dd>
          <dt>{t("邮件确认")}</dt>
          <dd>{canMail ? t("可用") : t("未配好（换绑 / 解绑会被禁用）")}</dd>
          <dt>{t("紧急密钥")}</dt>
          <dd>{hasRecovery ? t("已配置 RECOVERY_TOKEN") : t("未配置")}</dd>
        </dl>
      </section>

      <section className="section">
        <h2 className="section-title">{t("重置配置")}</h2>
        <p className="notice">
          {t(
            "需要把配置推倒重来时用这个：会清掉下面这些配置项的值。站点设置、文章、已绑定的 Passkey 和验证器都不动。"
          )}
        </p>
        {settingsStore() === "file" && (
          <p className="notice">
            {t(
              "站点设置存在 config/settings.json 里，这个文件不在重置范围内——重置不会碰它。想清空的话自己删这个文件。"
            )}
          </p>
        )}
        <ul className="config-checklist">
          {/* SETTINGS_STORE 不列出来：重置不会清它（它选的是设置存哪儿，
              不是凭据），列出来会让人以为会被清掉 */}
          {CONFIG_KEYS.filter((item) => item.key !== "SETTINGS_STORE").map(
            (item) => (
              <li key={item.key}>
                <code>{item.key}</code>
                <span>{t(item.label)}</span>
                <span className="config-item-state">
                  {/* auth 和 service 两组都写在 .env 里 */}
                  {canWriteEnv ? t(".env 文件") : t("环境变量")}
                </span>
              </li>
            )
          )}
        </ul>
        <ResetConfigButton envWritable={canWriteEnv} />

        <h2 className="section-title">{t("接下来做什么")}</h2>
        {passkeyCount === 0 && !hasTotp && (
          <p className="notice">
            
            {t("现在没有任何登录方式。用紧急密钥进门后，马上到")}
            <a href="/setup">  {t("安装向导")} </a>
            
            {t("把两把钥匙都绑上。")}
          </p>
        )}
        {passkeyCount === 0 && (
          <p className="notice">
            
            {t("还没有 Passkey：到")}<a href="/settings">  {t("设置页")} </a>{t("绑这台设备，Face ID / 指纹一按就能登录。")}
          </p>
        )}
        {!hasTotp && (
          <p className="notice">
            
            {t("还没有验证器：到")}<a href="/settings">  {t("设置页")} </a>{t("扫码绑定，这是 Passkey 之外的另一把钥匙。")}
          </p>
        )}
        {!canMail && (
          <p className="notice">
            
            {t("邮件确认没配好：需要服务端配置")} <code>RESEND_API_KEY</code>  {t("与")}
            <code> RESEND_FROM</code>{t("，并在站点设置里填好通知邮箱。否则更换 / 解绑验证器会被禁用。")}
          </p>
        )}
        {!hasRecovery && (
          <p className="notice">
            
            {t("建议配置一把紧急密钥")} <code>RECOVERY_TOKEN</code>{t("：两把钥匙都丢时用它进门。")}
          </p>
        )}
        {passkeyCount > 0 && hasTotp && canMail && hasRecovery && (
          <p className="notice">{t("该配的都配好了。重置只需要删掉对应凭据再重新绑定。")}</p>
        )}

        <p className="notice">
          
          {t("真要清空凭据：删数据库")} <code>auth</code>  {t("集合的")} <code>admin</code>  {t("文档等于解绑验证器； 删")} <code>passkeys</code>  {t("集合等于清空所有 Passkey。删完之后得用紧急密钥或安装向导重新配置。")}
        </p>
        <p className="notice">
          <a href="/setup">{t("重新走一遍安装向导")}</a>
          {settings.setupCompleted ? t("（初始化已完成）") : t("（初始化未完成）")}
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
