// 站点设置：站点展示信息 + 登录方式（Passkey / 手机验证器）
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { mailReady } from "@/lib/change-request";
import PasskeyManager from "./passkey-manager";
import TotpManager from "./totp-manager";
import SiteForm from "./site-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
          Passkey 绑好之后，登录不用输任何东西，用 Touch ID / 指纹一按就行。
          换设备重新绑一把即可。
        </p>
        <PasskeyManager />

        <h3 className="form-group">手机验证器</h3>
        <p className="notice">
          验证器是 Passkey 之外的另一把钥匙：手机上的 1Password、Google Authenticator、
          iOS 密码 App 都行，扫个码绑上，以后输 6 位数字就能登录。
        </p>
        <TotpManager bound={bound} mailReady={canMail} />
      </section>

      <SiteFooter />
    </main>
  );
}
