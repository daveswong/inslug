"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasskeyManager, { type PasskeyView } from "@/app/settings/passkey-manager";
import TotpManager from "@/app/settings/totp-manager";

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
};

const STEPS = ["站点信息", "Passkey", "验证器", "完成"];
const LABELS = ["已保存", "已绑定", "已绑定", ""];

export default function SetupWizard({
  initial,
  passkeyCount,
  passkeys,
  authorized,
  hasTotp,
  mailReady,
  completed,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<SiteValues>(initial);
  const [siteSaved, setSiteSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const done = [siteSaved, passkeyCount > 0, hasTotp, false];

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
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setSiteSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
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
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
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
          <h2 className="section-title">站点信息</h2>
          <p className="notice">
            站点名、简介、分页大小，以及接收验证器变更确认信的邮箱。
            数据库密钥不在这里填——那些只能配在服务端。
          </p>
          <form className="setup-form" onSubmit={saveSite}>
            <label className="field">
              <span className="field-label">站点名</span>
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
              <span className="field-label">简介</span>
              <input
                className="search-input"
                value={values.description}
                onChange={(e) => {
                  setValues({ ...values, description: e.target.value });
                  setSiteSaved(false);
                }}
                placeholder="一句话介绍这个站子"
              />
            </label>
            <label className="field">
              <span className="field-label">每页文章数</span>
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
              <span className="field-label">通知邮箱</span>
              <input
                className="search-input"
                type="email"
                value={values.notifyEmail}
                onChange={(e) => {
                  setValues({ ...values, notifyEmail: e.target.value });
                  setSiteSaved(false);
                }}
                placeholder="更换或解绑验证器时收确认信"
              />
            </label>
            <button
              className="btn btn-outline-light btn-plain"
              type="submit"
              disabled={busy || !values.siteName}
            >
              保存站点信息
            </button>
          </form>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="section-title">绑定 Passkey</h2>
          <p className="notice">
            主登录方式。绑好之后 Touch ID / 指纹一按就能进来，不用输任何东西。
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

      {step === 2 && (
        <>
          <h2 className="section-title">绑定手机验证器</h2>
          <p className="notice">
            另一把钥匙。Passkey 不在手边时，用手机上的 6 位码登录。
            {hasTotp && " 当前已经绑好。"}
          </p>
          <TotpManager
            bound={hasTotp}
            mailReady={mailReady}
            onBound={() => router.refresh()}
          />
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="section-title">完成</h2>
          <p className="notice">
            {completed
              ? "初始化已经完成过，这里只是让你回头检查。"
              : "两把钥匙都配好之后就可以开写了。以后在站点设置里随时能改。"}
          </p>
          {!hasTotp && (
            <p className="notice">验证器还没绑：建议回到第 3 步，别只留 Passkey 一把钥匙。</p>
          )}
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={finish}
            disabled={busy}
          >
            完成安装，回首页
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
            上一步
          </button>
        )}
        {step < 3 && (
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={() => setStep(step + 1)}
          >
            下一步
          </button>
        )}
        {done[step] && <span className="notice">{LABELS[step]}</span>}
      </div>
    </section>
  );
}
