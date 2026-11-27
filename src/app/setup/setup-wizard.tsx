"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasskeyManager, { type PasskeyView } from "@/app/settings/passkey-manager";
import TotpManager from "@/app/settings/totp-manager";
import type { ConfigField } from "@/lib/config-keys";
import type { DatabaseStatus } from "@/lib/mongodb";
import { useT } from "@/components/i18n-provider";
import type { ServiceFeature } from "@/components/service-config-fields";
import AuthConfigPanel, { type GeneratedItem } from "./auth-config-panel";

type SiteValues = {
  siteName: string;
  description: string;
  notifyEmail: string;
  postsPerPage: number;
};

type Props = {
  initial: SiteValues;
  passkeyCount: number;
  passkeys: PasskeyView[];
  authorized: boolean;
  hasTotp: boolean;
  /** 邮箱是否已经通过邮件链接确认过 */
  initialEmailConfirmed: boolean;
  mailReady: boolean;
  completed: boolean;
  /** 身份验证与启动必需的变量（手填的那些） */
  authItems: ConfigField[];
  /** 由程序生成的密钥 */
  generatedAuthItems: GeneratedItem[];
  /** 邮件与图片存储的配置（按方案分组） */
  serviceFeatures: ServiceFeature[];
  /** 能不能写 .env 文件（Vercel 上不行） */
  envWritable: boolean;
  /** 能不能写配置文件（写不了就不提供「配置文件」这个选项） */
  fileWritable: boolean;
  onVercel: boolean;
  loggedIn: boolean;
  /** 当前库的状态：存在还是刚建的 */
  dbStatus: DatabaseStatus | null;
  /** 有没有配数据库地址 */
  dbConfigured: boolean;
  /** 服务器上有没有生效的 RECOVERY_TOKEN（Vercel 上要导入 .env 并重新部署之后才有） */
  recoveryReady: boolean;
  /** 服务器实际读到的 Passkey 域名主体 */
  rpId: string;
  /** 服务器实际读到的站点地址 */
  origin: string;
  /** 这次请求是从哪个域名进来的 */
  requestHost: string;
  /** RP_ID 与当前域名是否对得上（浏览器的要求：相等或是它的可注册域后缀） */
  rpIdMatchesHost: boolean;
  /** ORIGIN 里的主机名 */
  originHost: string;
  /** 数据库连上了但读不到凭据：这时不能免登录，得跟站长说清楚 */
  credentialProbeFailed: boolean;
};

export default function SetupWizard({
  initial,
  passkeyCount,
  passkeys,
  authorized,
  hasTotp,
  initialEmailConfirmed,
  mailReady,
  completed,
  authItems,
  generatedAuthItems,
  serviceFeatures,
  envWritable,
  fileWritable,
  onVercel,
  loggedIn,
  dbStatus,
  dbConfigured,
  recoveryReady,
  rpId,
  origin,
  requestHost,
  rpIdMatchesHost,
  originHost,
  credentialProbeFailed,
}: Props) {
  const t = useT();
  const STEPS = [
    t("服务器配置"),
    t("确认邮箱"),
    "Passkey",
    t("验证器"),
    t("完成"),
  ];
  const LABELS = [t("已写入"), t("已确认"), t("已绑定"), t("已绑定"), ""];
  const router = useRouter();
  // 邮箱已经确认过的（刚从确认链接回来，或之前就装过），
  // 直接落在绑定 Passkey 那一步，不用再走一遍
  const [step, setStep] = useState(initialEmailConfirmed ? 2 : 0);
  const [values, setValues] = useState<SiteValues>(initial);
  const [emailConfirmed, setEmailConfirmed] = useState(initialEmailConfirmed);
  const [emailSent, setEmailSent] = useState(false);
  // 用户主动跳过了哪一步。跳过了就要明确告诉他后果。
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const done = [true, emailConfirmed, passkeyCount > 0, hasTotp, false];

  /**
   * 填完邮箱，发一封确认信。
   *
   * 站点信息（站名、简介）不在这一步填了——装完到设置页再弄，
   * 这里只确认邮箱，顺便验证发信通道确实是通的。
   */
  const sendConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/setup/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: values.notifyEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("发送失败"));
      setEmailSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("发送失败"));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/setup/complete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("保存失败"));
      // 装完直接进设置页填站点信息
      router.push("/settings");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("保存失败"));
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <ol className="setup-steps">
        {STEPS.map((name, index) => (
          <li key={name} className={index === step ? "current" : ""}>
            <button
              type="button"
              // 第 1 步（确认邮箱）没过，不许点到后面的步骤——
              // 否则「填邮箱发确认信」这一步就能被绕过去
              disabled={index > 1 && !emailConfirmed}
              onClick={() => setStep(index)}
            >
              {index + 1}. {name}
              {index < 3 && done[index] && <span className="setup-done"> ✓</span>}
            </button>
          </li>
        ))}
      </ol>

      {step > 0 && !loggedIn && (
        <p className="notice">
          {t("这一步需要先登录。")}
          {!recoveryReady
            ? t(
                "服务器上还没有生效的 RECOVERY_TOKEN——先把第 1 步的 .env 导入 Vercel 并重新部署，紧急入口才会开。"
              )
            : t("用 .env 里的 RECOVERY_TOKEN 从紧急入口进入。")}
          {" "}
          <a href="/login?recovery=1&next=%2Fsetup">{t("去登录")}</a>
        </p>
      )}

      {step === 0 && (
        <>
          <h2 className="section-title">{t("身份验证与启动配置")}</h2>
          {credentialProbeFailed && (
            <p className="form-error">
              {t(
                "数据库连上了但读不到登录凭据：可能是数据库用户的权限不够。为了安全起见，这时不能免登录修改配置——先修好数据库权限再回来。"
              )}
            </p>
          )}
          <p className="notice">
            {onVercel
              ? t(
                  "Vercel 不能写文件：下载 .env 后导入环境变量，再重新部署。"
                )
              : t(
                  "写入项目根目录的 .env，不进 Git。"
                )}
          </p>
          <p className="notice">
            {t(
              "后面几步需要登录。首次请用 .env 里的 RECOVERY_TOKEN 从紧急入口进入。"
            )}
          </p>
          <AuthConfigPanel
            manualItems={authItems}
            generatedItems={generatedAuthItems}
            envWritable={envWritable}
            fileWritable={fileWritable}
            serviceFeatures={serviceFeatures}
          />

          {!recoveryReady && (
            <p className="notice">
              {t(
                "配置尚未生效：Vercel 需导入 .env 并重新部署，之后紧急登录才可用。"
              )}
            </p>
          )}

          {onVercel && (
            <ol className="reset-steps">
              <li>{t("填好各项，下载生成的 .env。")}</li>
              <li>
                {t(
                  "到 Vercel 项目 → Settings → Environment Variables，上传这个 .env 文件。"
                )}
              </li>
              <li>{t("重新部署并等待完成。")}</li>
              <li>
                {t("用 RECOVERY_TOKEN 从紧急入口登录，继续第 2 步。")}
              </li>
            </ol>
          )}

          {(rpId || origin) && (
            <dl className="confirm-meta">
              <dt>{t("当前域名")}</dt>
              <dd>{requestHost || t("（未知）")}</dd>
              <dt>RP_ID</dt>
              <dd>{rpId || t("（未配置）")}</dd>
              <dt>ORIGIN</dt>
              <dd>{origin || t("（未配置）")}</dd>
            </dl>
          )}

          {!!rpId && !rpIdMatchesHost && (
            <p className="form-error">
              {t(
                "RP_ID 和当前域名对不上，浏览器会拒绝绑定 Passkey（报错是 The RP ID \"...\" is invalid for this domain）。RP_ID 要填当前域名本身，或者它的上级可注册域，不能带 https://、端口或路径。"
              )}
              {" "}
              {requestHost
                ? t("按当前域名，应填：{host}", { host: requestHost })
                : t("改成当前站点的域名，不带协议。")}
            </p>
          )}

          {!!originHost && requestHost && originHost !== requestHost && (
            <p className="form-error">
              {t(
                "ORIGIN 与当前域名不符，确认邮件链接会指向别处。应填 https://{host}",
                { host: requestHost }
              )}
            </p>
          )}

          {dbStatus ? (
            <p className="notice">
              {dbStatus.created
                ? t("数据库 {name} 已创建，连得上。", { name: dbStatus.dbName })
                : t("数据库 {name} 连得上，里面有 {n} 篇文章。", {
                    name: dbStatus.dbName,
                    n: String(dbStatus.postCount),
                  })}
            </p>
          ) : dbConfigured ? (
            <p className="form-error">
              {t(
                "地址填了，但连不上。查两处：连接串里的用户名密码对不对，Atlas 的 Network Access 里有没有放行当前出口 IP（加上 0.0.0.0/0 最省事）。改完刷新本页就行，不用重新部署。"
              )}
            </p>
          ) : (
            <p className="form-error">
              {t(
                "数据库还没连上。配好 MONGODB_URI 再往下走——后面的确认邮件、钥匙绑定都靠它。"
              )}
            </p>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="section-title">{t("确认邮箱")}</h2>
          <p className="notice">
            {t("填一个你常用的邮箱。我们会发一封确认信过去，点里面的链接就继续安装。")}
          </p>
          <p className="notice">
            {t("这个邮箱会用来接收验证器变更、恢复入口之类的确认信，装完也能在设置里改。")}
          </p>
          <form className="setup-form" onSubmit={sendConfirm}>
            <label className="field">
              <span className="field-label">{t("通知邮箱")}</span>
              <input
                className="search-input"
                type="email"
                value={values.notifyEmail}
                onChange={(e) => {
                  setValues({ ...values, notifyEmail: e.target.value });
                  setEmailSent(false);
                }}
                placeholder={t("你常用的邮箱")}
              />
            </label>
            <button
              className="btn btn-outline-light btn-plain"
              type="submit"
              disabled={busy || !values.notifyEmail.trim() || !dbStatus}
            >
              {busy ? t("发送中…") : t("发送确认邮件")}
            </button>
            {!dbStatus && (
              <p className="form-error">
                {t("数据库还没连上，先回上一步把 MONGODB_URI 配好。")}
              </p>
            )}
          </form>
          {emailSent && (
            <p className="notice">
              {t("确认信已发出：去邮箱点一下里面的链接，接着往下装。链接 10 分钟内有效。")}
            </p>
          )}
          <p className="notice">
            {t("站点名、简介这些装完再填也不迟，装完到设置页里改。")}
          </p>
        </>
      )}

      {step === 2 && (
        <>
          {skipped[2] && (
            <p className="notice">
              {t("已跳过 Passkey。之后只能用 .env 里的 RECOVERY_TOKEN 登录，随时可以回来补。")}
            </p>
          )}
          <h2 className="section-title">{t("绑定 Passkey")}</h2>
          <p className="notice">
            
            {t("主登录方式，绑好后 Touch ID / 指纹一按即可。")}
            {passkeyCount > 0 && t("当前已绑 {n} 把。", { n: passkeyCount })}
          </p>
          <PasskeyManager
            passkeys={passkeys}
            authorized={authorized}
            mailReady={mailReady}
            onBound={() => router.refresh()}
          />
          {passkeyCount === 0 && !skipped[2] && (
            <div className="setup-nav">
              <button
                className="btn btn-outline-light btn-plain"
                type="button"
                onClick={() => setSkipped({ ...skipped, 2: true })}
              >
                {t("跳过，之后再说")}
              </button>
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <>
          {skipped[3] && (
            <p className="notice">
              {t("已跳过验证器。之后只能用 .env 里的 RECOVERY_TOKEN 登录，随时可以回来补。")}
            </p>
          )}
          <h2 className="section-title">{t("绑定手机验证器")}</h2>
          <p className="notice">
            
            {t("备用登录方式，用手机上的 6 位码登录。")}
            {hasTotp && t("当前已经绑好。")}
          </p>
          <TotpManager
            bound={hasTotp}
            mailReady={mailReady}
            onBound={() => router.refresh()}
          />
          {!hasTotp && !skipped[3] && (
            <div className="setup-nav">
              <button
                className="btn btn-outline-light btn-plain"
                type="button"
                onClick={() => setSkipped({ ...skipped, 3: true })}
              >
                {t("跳过，之后再说")}
              </button>
            </div>
          )}
        </>
      )}

      {step === 4 && (
        <>
          <h2 className="section-title">{t("完成")}</h2>
          <p className="notice">
            {completed
              ? t("已完成初始化，这里供复查。")
              : t("接下来去设置页填站点信息（站名、简介、SEO），随时可以改。")}
          </p>
          {(!hasTotp || passkeyCount === 0) && (
            <p className="notice">
              {t("两把钥匙没配齐：以后只能用 .env 里的 RECOVERY_TOKEN 登录，建议去设置里补上。")}
            </p>
          )}
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={finish}
            disabled={busy}
          >
            
            {t("完成安装，去设置页")}
          </button>
        </>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="setup-nav">
        {step > 0 && (
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={() => setStep(step - 1)}
          >
            
            {t("上一步")}
          </button>
        )}
        {step < 4 && (
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            // 第 1 步是确认邮箱：没收到确认信就不许往下走，
            // 否则「填邮箱发确认信」这一步就形同虚设
            disabled={step === 1 && !emailConfirmed}
            onClick={() => setStep(step + 1)}
          >
            
            {t("下一步")}
          </button>
        )}
        {done[step] && <span className="notice">{LABELS[step]}</span>}
      </div>
    </section>
  );
}
