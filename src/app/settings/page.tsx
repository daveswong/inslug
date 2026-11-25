// 站点设置：站点展示信息 + 登录方式（Passkey）
import SiteFooter from "@/components/SiteFooter";
import { getSettings } from "@/lib/settings";
import PasskeyManager from "./passkey-manager";
import SiteForm from "./site-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

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

      <SiteFooter />
    </main>
  );
}
