"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasskeyManager, { type PasskeyView } from "@/app/settings/passkey-manager";
import TotpManager from "@/app/settings/totp-manager";
import type { ConfigField } from "@/components/config-fields";
import { saveServiceConfig } from "./config-actions";
import type { DatabaseStatus } from "@/lib/mongodb";
import { useT } from "@/components/i18n-provider";
import ServiceConfigFields, { type ServiceFeature } from "@/components/service-config-fields";
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
  onVercel: boolean;
  loggedIn: boolean;
  /** 数据库现在连得上吗。服务类配置存在数据库里，连不上就存不了 */
  dbOk: boolean;
  /** 当前库的状态：存在还是刚建的 */
  dbStatus: DatabaseStatus | null;
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
  onVercel,
  loggedIn,
  dbOk,
  dbStatus,
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

      {step === 0 && (
        <>
          <h2 className="section-title">{t("身份验证与启动配置")}</h2>
          <p className="notice">
            {onVercel
              ? t(
                  "当前跑在 Vercel 上，文件系统是只读的。填完点「生成 .env 文件」，下载后导入到 Vercel 的环境变量里，再重新部署。"
                )
              : t(
                  "下面这些值会写进项目根目录的 .env 文件。这个文件不在 Git 里，部署时生成。"
                )}
          </p>
          <AuthConfigPanel
            manualItems={authItems}
            generatedItems={generatedAuthItems}
            envWritable={envWritable}
          />

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

          <h2 className="section-title">{t("邮件与图片存储")}</h2>
          {dbOk ? (
            <>
              <p className="notice">
                {t("这两项存在数据库里，部署之后随时可以在这里改，不用重新部署。")}
              </p>
              <ServiceConfigFields
                features={serviceFeatures}
                onSave={saveServiceConfig}
                successHint={t("已保存，立刻生效。")}
              />
            </>
          ) : (
            <p className="notice">
              {t(
                "这两项存在数据库里，得等数据库连上之后才能保存。先把上面的数据库地址配好，再回到这一步。"
              )}
            </p>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="section-title">{t("站点信息")}</h2>
          <p className="notice">
            
            {t("站点名、简介、分页大小，以及接收验证器变更确认信的邮箱。 数据库密钥不在这里填——那些只能配在服务端。")}
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
            
            {t("主登录方式。绑好之后 Touch ID / 指纹一按就能进来，不用输任何东西。")}
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
            
            {t("另一把钥匙。Passkey 不在手边时，用手机上的 6 位码登录。")}
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
              ? t("初始化已经完成过，这里只是让你回头检查。")
              : t("两把钥匙都配好之后就可以开写了。以后在站点设置里随时能改。")}
          </p>
          {!hasTotp && (
            <p className="notice">{t("验证器还没绑：建议回到第 4 步，别只留 Passkey 一把钥匙。")}</p>
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
