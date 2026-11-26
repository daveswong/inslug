// 恢复指引：未登录只给通用步骤（不泄露状态）；登录后按实际状态给出针对性步骤
import SiteFooter from "@/components/SiteFooter";
import ResetConfigButton from "./reset-config-button";
import RecoveryTokenPanel from "./recovery-token-panel";
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { listPasskeys } from "@/lib/passkey";
import { mailReady } from "@/lib/change-request";
import { canWriteEnvFile, getEnvValue } from "@/lib/env-config";
import { CONFIG_KEYS } from "@/lib/config-keys";
import { getT } from "@/lib/i18n";

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
            {t("进去后立刻重新绑定 Passkey 和验证器，再把这把临时密钥删掉。")}
          </p>
        </section>

        <SiteFooter />
      </main>
    );
  }

  const settings = await getSettings();
  const passkeyCount = (await listPasskeys()).length;
  let hasTotp = false;
  try {
    hasTotp = !!(await getAuth()).totpSecret;
  } catch {
    hasTotp = false;
  }
  const canMail = await mailReady().catch(() => false);
  const canWriteEnv = canWriteEnvFile();
  const token = getEnvValue("RECOVERY_TOKEN") ?? "";
  const hasRecovery = token.length >= 16;

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{t("恢复指引")}</h1>
        <p className="site-desc">{t("当前状态与下一步。只显示配置是否存在，不显示任何密钥内容。")}</p>
      </header>

      <section className="section">
        <h2 className="section-title">{t("当前状态")}</h2>
        <dl className="confirm-meta">
          <dt>Passkey</dt>
          <dd>{passkeyCount > 0 ? `已绑定 ${passkeyCount} 把` : t("没有绑定")}</dd>
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
        <ul className="config-checklist">
          {CONFIG_KEYS.map((item) => (
            <li key={item.key}>
              <code>{item.key}</code>
              <span>{t(item.label)}</span>
              <span className="config-item-state">
                {item.group === "auth"
                  ? canWriteEnv
                    ? t(".env 文件")
                    : t("环境变量")
                  : t("数据库")}
              </span>
            </li>
          ))}
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
            
            {t("建议临时配置一把紧急密钥")} <code>RECOVERY_TOKEN</code>{t("：两把钥匙都丢时用它进门， 用完之后删掉。")}
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
