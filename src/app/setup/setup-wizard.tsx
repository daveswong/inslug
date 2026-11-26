"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasskeyManager, { type PasskeyView } from "@/app/settings/passkey-manager";
import TotpManager from "@/app/settings/totp-manager";
import type { ConfigField } from "@/components/config-fields";
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
};

export default function SetupWizard({
  initial,
  passkeyCount,
  passkeys,
  authorized,
  hasTotp,
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
  recoveryReady,
  rpId,
  origin,
  requestHost,
  rpIdMatchesHost,
  originHost,
}: Props) {
  const t = useT();
  const STEPS = [
    t("服务器配置"),
    t("站点信息"),
    "Passkey",
    t("验证器"),
    t("完成"),
  ];
  const LABELS = [t("已写入"), t("已保存"), t("已绑定"), t("已绑定"), ""];
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<SiteValues>(initial);
  const [siteSaved, setSiteSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const done = [true, siteSaved, passkeyCount > 0, hasTotp, false];

  const saveSite = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/setup/site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("保存失败"));
      setSiteSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("保存失败"));
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
      router.push("/");
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
            <button type="button" onClick={() => setStep(index)}>
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

          {dbStatus && (
            <p className="notice">
              {dbStatus.created
                ? t("数据库 {name} 已创建", { name: dbStatus.dbName })
                : t("数据库 {name} 已存在，里面有 {n} 篇文章", {
                    name: dbStatus.dbName,
                    n: String(dbStatus.postCount),
                  })}
            </p>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="section-title">{t("站点信息")}</h2>
          <p className="notice">
            
            {t("填写站点信息；密钥只在服务端配置。")}
          </p>
          <form className="setup-form" onSubmit={saveSite}>
            <label className="field">
              <span className="field-label">{t("站点名")}</span>
              <input
                className="search-input"
                value={values.siteName}
                onChange={(e) => {
                  setValues({ ...values, siteName: e.target.value });
                  setSiteSaved(false);
                }}
              />
            </label>
            <label className="field">
              <span className="field-label">{t("简介")}</span>
              <input
                className="search-input"
                value={values.description}
                onChange={(e) => {
                  setValues({ ...values, description: e.target.value });
                  setSiteSaved(false);
                }}
                placeholder={t("一句话介绍这个站子")}
              />
            </label>
            <label className="field">
              <span className="field-label">{t("每页文章数")}</span>
              <input
                className="search-input"
                type="number"
                min={1}
                max={50}
                value={values.postsPerPage}
                onChange={(e) => {
                  setValues({ ...values, postsPerPage: Number(e.target.value) });
                  setSiteSaved(false);
                }}
              />
            </label>
            <label className="field">
              <span className="field-label">{t("通知邮箱")}</span>
              <input
                className="search-input"
                type="email"
                value={values.notifyEmail}
                onChange={(e) => {
                  setValues({ ...values, notifyEmail: e.target.value });
                  setSiteSaved(false);
                }}
                placeholder={t("更换或解绑验证器时收确认信")}
              />
            </label>
            <button
              className="btn btn-outline-light btn-plain"
              type="submit"
              disabled={busy || !values.siteName}
            >
              
              {t("保存站点信息")}
            </button>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="section-title">{t("绑定 Passkey")}</h2>
          <p className="notice">
            
            {t("主登录方式，绑好后 Touch ID / 指纹一按即可。")}
            {passkeyCount > 0 && ` 当前已绑 ${passkeyCount} 把。`}
          </p>
          <PasskeyManager
            passkeys={passkeys}
            authorized={authorized}
            mailReady={mailReady}
            onBound={() => router.refresh()}
          />
        </>
      )}

      {step === 3 && (
        <>
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
        </>
      )}

      {step === 4 && (
        <>
          <h2 className="section-title">{t("完成")}</h2>
          <p className="notice">
            {completed
              ? t("已完成初始化，这里供复查。")
              : t("两把钥匙齐了，以后可在设置里随时改。")}
          </p>
          {!hasTotp && (
            <p className="notice">{t("验证器还没绑，建议回到第 4 步。")}</p>
          )}
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={finish}
            disabled={busy}
          >
            
            {t("完成安装，回首页")}
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
