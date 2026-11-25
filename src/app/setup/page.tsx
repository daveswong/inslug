// 首次安装向导：登录后一次性把站点信息和两把钥匙配好
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getAuth, passkeyAddAllowed } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { listPasskeys } from "@/lib/passkey";
import { mailReady } from "@/lib/change-request";
import SetupWizard from "./setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await isLoggedIn())) redirect("/login?next=%2Fsetup");

  const settings = await getSettings();
  const [keyDocs, authorized] = await Promise.all([
    listPasskeys().catch(() => []),
    passkeyAddAllowed().catch(() => false),
  ]);
  const passkeyCount = keyDocs.length;
  const passkeys = keyDocs.map((key) => ({
    credentialId: key.credentialId,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    transports: key.transports ?? [],
  }));

  let hasTotp = false;
  try {
    hasTotp = !!(await getAuth()).totpSecret;
  } catch {
    hasTotp = false;
  }
  const canMail = await mailReady().catch(() => false);

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">首次安装</h1>
        <p className="site-desc">
          分四步把站点和登录方式配好。这里改的都是站点设置与登录凭据，不涉及数据库密钥。
        </p>
      </header>

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
        mailReady={canMail}
        completed={settings.setupCompleted}
      />

      <SiteFooter />
    </main>
  );
}
