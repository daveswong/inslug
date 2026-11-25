// 站点设置：站点展示信息 + 登录方式（Passkey）+ 修改密码
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isMailConfigured } from "@/lib/mail";
import PasskeyManager from "./passkey-manager";
import PasswordForm from "./password-form";
import SiteForm from "./site-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // middleware 只验签名，会话版本失效（改过密码）的旧 cookie 要在这里挡掉
  if (!(await isLoggedIn())) redirect("/login?next=%2Fsettings");

  const settings = await getSettings();
  // 三个条件缺一不可：API key、发件人、收件邮箱
  const mailReady = isMailConfigured() && settings.notifyEmail.trim().length > 0;

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">站点设置</h1>
      </header>

      <section className="section">
        <h2 className="section-title">站点信息</h2>
        <SiteForm settings={settings} />
      </section>

      <section className="section">
        <h2 className="section-title">登录</h2>
        <p className="notice">
          绑一把 Passkey 后，登录不用再输密码，用 Touch ID / 指纹一按就行。
          换设备重新绑一把即可。
        </p>
        <PasskeyManager />
      </section>

      <section className="section">
        <h2 className="section-title">修改密码</h2>
        {mailReady ? (
          <>
            <p className="notice">
              提交后会往通知邮箱发一封确认信，点开链接再确认一次才生效。
              确认之后所有设备都需要重新登录。
              没收到的话看一眼垃圾邮件，链接 10 分钟内有效。
            </p>
            <PasswordForm />
          </>
        ) : (
          <p className="notice">
            还没配好邮件确认（需要服务端的 RESEND_API_KEY、RESEND_FROM，以及上面的通知邮箱），
            所以这里暂不开放修改。要重置密码，改环境变量 ADMIN_PASSWORD_HASH 后重新部署，
            或删掉数据库 auth 集合里那条记录。
          </p>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
