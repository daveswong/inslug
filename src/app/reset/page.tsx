// 恢复指引：未登录只给通用步骤（不泄露状态）；登录后按实际状态给出针对性步骤
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { listPasskeys } from "@/lib/passkey";
import { mailReady } from "@/lib/change-request";

export const dynamic = "force-dynamic";

export default async function ResetPage() {
  const loggedIn = await isLoggedIn();

  if (!loggedIn) {
    return (
      <main className="site">
        <header className="site-head">
          <h1 className="site-title">恢复指引</h1>
          <p className="site-desc">下面是通用步骤。登录后打开这一页，会直接按你的实际状态列。</p>
        </header>

        <section className="section">
          <ol className="reset-steps">
            <li>
              Passkey 还在手上：直接<a href="/login">登录</a>。
            </li>
            <li>
              只有手机验证器在手：在<a href="/login">登录页</a>输 6 位码。
            </li>
            <li>
              两把钥匙都不在手：去 Vercel 项目 → Settings → Environment Variables 加一条
              <code> RECOVERY_TOKEN </code>（用 <code>openssl rand -base64 32</code> 生成，
              至少 16 字符），等重新部署后打开
              <a href="/login?recovery=1">紧急登录</a>，把那串密钥粘进去。
            </li>
            <li>
              进去之后立刻重新绑定 Passkey 和验证器，然后回 Vercel 把
              <code> RECOVERY_TOKEN </code> 删掉。
            </li>
          </ol>
          <p className="notice">
            注意：数据库地址、会话密钥这些只能在服务端配，网页里不提供填写入口。
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
  const token = process.env.RECOVERY_TOKEN ?? "";
  const hasRecovery = token.length >= 16;

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">恢复指引</h1>
        <p className="site-desc">当前状态与下一步。只显示配置是否存在，不显示任何密钥内容。</p>
      </header>

      <section className="section">
        <h2 className="section-title">当前状态</h2>
        <dl className="confirm-meta">
          <dt>Passkey</dt>
          <dd>{passkeyCount > 0 ? `已绑定 ${passkeyCount} 把` : "没有绑定"}</dd>
          <dt>手机验证器</dt>
          <dd>{hasTotp ? "已绑定" : "未绑定"}</dd>
          <dt>邮件确认</dt>
          <dd>{canMail ? "可用" : "未配好（换绑 / 解绑会被禁用）"}</dd>
          <dt>紧急密钥</dt>
          <dd>{hasRecovery ? "已配置 RECOVERY_TOKEN" : "未配置"}</dd>
        </dl>
      </section>

      <section className="section">
        <h2 className="section-title">接下来做什么</h2>
        {passkeyCount === 0 && !hasTotp && (
          <p className="notice">
            现在没有任何登录方式。用紧急密钥进门后，马上到
            <a href="/setup"> 安装向导 </a>
            把两把钥匙都绑上。
          </p>
        )}
        {passkeyCount === 0 && (
          <p className="notice">
            还没有 Passkey：到<a href="/settings"> 设置页 </a>绑这台设备，Face ID / 指纹一按就能登录。
          </p>
        )}
        {!hasTotp && (
          <p className="notice">
            还没有验证器：到<a href="/settings"> 设置页 </a>扫码绑定，这是 Passkey 之外的另一把钥匙。
          </p>
        )}
        {!canMail && (
          <p className="notice">
            邮件确认没配好：需要服务端配置 <code>RESEND_API_KEY</code> 与
            <code> RESEND_FROM</code>，并在设置页「通知」里填好邮箱。
            否则更换 / 解绑验证器会被禁用。
          </p>
        )}
        {!hasRecovery && (
          <p className="notice">
            建议临时配置一把紧急密钥 <code>RECOVERY_TOKEN</code>：两把钥匙都丢时用它进门，
            用完之后删掉。
          </p>
        )}
        {passkeyCount > 0 && hasTotp && canMail && hasRecovery && (
          <p className="notice">该配的都配好了。重置只需要删掉对应凭据再重新绑定。</p>
        )}

        <p className="notice">
          真要清空凭据：删数据库 <code>auth</code> 集合的 <code>admin</code> 文档等于解绑验证器；
          删 <code>passkeys</code> 集合等于清空所有 Passkey。删完之后得用紧急密钥或安装向导重新配置。
        </p>
        <p className="notice">
          <a href="/setup">重新走一遍安装向导</a>
          {settings.setupCompleted ? "（初始化已完成）" : "（初始化未完成）"}
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
