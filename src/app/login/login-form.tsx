"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { useT } from "@/components/i18n-provider";
import { safeInternalPath } from "@/lib/safe-path";
import {
  RECOVERY_DELETE_HINT,
  RECOVERY_SETUP_HINT,
} from "@/lib/recovery-hints";
import { generateRecoveryTokenAction } from "@/app/setup/secrets-actions";

/**
 * 登录：Passkey 与验证器二选一。
 *
 * 没有密码了——密码能猜、能撞、能忘，换来的安全性还不如一把 Passkey。
 * 紧急入口（登录页加 ?recovery=1）只在两把钥匙都丢了时用，密钥在环境变量
 * RECOVERY_TOKEN 里（存在服务端 .env 或 Vercel 后台，不在数据库），进来之后应立刻重新绑定两把钥匙。
 */

type Props = {
  loggedIn: boolean;
  next: string;
  /** 带 ?recovery=1 时才显示紧急入口，平时不占版面 */
  recovery: boolean;
  /** 是否已绑定 Passkey */
  passkeyReady: boolean;
  /** 是否已绑定验证器 */
  totpReady: boolean;
  /** 服务器上是否配置了 RECOVERY_TOKEN */
  recoveryReady: boolean;
  /** 初始化没走完时，从首页登录直接送去安装向导 */
  needsSetup: boolean;
};

export default function LoginForm({
  loggedIn,
  next,
  recovery,
  passkeyReady,
  totpReady,
  recoveryReady,
  needsSetup,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [recoveryMissing, setRecoveryMissing] = useState(false);
  // 临时生成的恢复密钥：只存在浏览器内存里，页面只显示掩码，复制时给完整值
  const [newRecoveryToken, setNewRecoveryToken] = useState("");
  const [copied, setCopied] = useState(false);

  /** 生成恢复密钥：不写环境变量，用户复制后自行保存到 .env / Vercel */
  const generateRecoveryToken = async () => {
    setError("");
    setCopied(false);
    try {
      const result = await generateRecoveryTokenAction();
      setNewRecoveryToken(result.recoveryToken);
    } catch {
      setError(t("生成失败"));
    }
  };

  /** 复制完整密钥；页面上的掩码只是给人看的，不会进剪贴板 */
  const copyRecoveryToken = async () => {
    if (!newRecoveryToken) return;
    try {
      await navigator.clipboard.writeText(newRecoveryToken);
      setCopied(true);
    } catch {
      setError(t("复制失败，请手动选中复制"));
    }
  };

  /** 掩码显示：首尾各留几位方便认，中间不显示 */
  const masked = (value: string) =>
    value.length <= 12
      ? "••••••••"
      : `${value.slice(0, 4)}••••••••${value.slice(-4)}`;

  const go = () => {
    // next 来自 URL，必须先过站内白名单：
    // 否则 /login?next=https://evil.com 就是开放重定向，登录后被带走。
    const safe = safeInternalPath(next, "/");
    // 只有目标是首页时才改道；从中间件跳来的 ?next=/settings 保持原样
    const target = needsSetup && (safe === "/" || safe === "") ? "/setup" : safe;
    router.replace(target);
    router.refresh();
  };

  const loginWithPasskey = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const optionsRes = await fetch("/api/auth/passkey/login/options");
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? t("无法开始 Passkey 登录"));

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error ?? t("验证失败"));
      go();
    } catch (e) {
      if (e instanceof Error && e.name === "NotAllowedError") {
        setError(
          t("浏览器这次没放行 Passkey：再点一次按钮试试；反复不行就换独立标签页打开本站。如果还是不行，用下面的 6 位验证码登录。")
        );
      } else {
        setError(e instanceof Error ? e.message : t("登录失败"));
      }
    } finally {
      setBusy(false);
    }
  };

  const loginWithCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/totp/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("登录失败"));
      go();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("登录失败"));
    } finally {
      setBusy(false);
    }
  };

  const loginWithRecoveryKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: recoveryKey }),
      });
      const data = await res.json();
      if (data.code === "NOT_CONFIGURED") {
        // 未配置不是错误：只给设置方法，不报错、不跳安装页。
        setRecoveryMissing(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? t("登录失败"));
      setRecoveryDone(true);
      setRecoveryKey("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("登录失败"));
    } finally {
      setBusy(false);
    }
  };

  if (loggedIn) {
    return (
      <section className="section">
        <p className="notice">{t("已经登录了。")}</p>
        <div className="tag-list d-flex flex-wrap">
          <a href="/">{t("返回首页")}</a>
          <a href="/write">{t("写文章")}</a>
          <a href="/settings">{t("站点设置")}</a>
        </div>
      </section>
    );
  }

  if (recoveryDone) {
    return (
      <section className="section">
        <p className="notice">
          {t("已用紧急密钥登录。请尽快到站点设置里重新绑定 Passkey 和验证器。")}
        </p>
        <p className="notice">{t(RECOVERY_DELETE_HINT)}</p>
        <button
          className="btn btn-outline-light btn-plain"
          type="button"
          onClick={go}
        >
          {t("继续")}
        </button>
      </section>
    );
  }

  return (
    <section className="section">
      <button
        className="btn btn-outline-light btn-plain"
        type="button"
        disabled={busy || !passkeyReady}
        onClick={loginWithPasskey}
      >
        
        {t("用 Passkey 登录")}
      </button>

      <p className="notice">{t("或者用手机验证器里的 6 位码。")}</p>
      <form className="login-form d-flex" onSubmit={loginWithCode}>
        <input
          className="search-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder={t("6 位验证码")}
          aria-label={t("6 位验证码")}
          disabled={!totpReady}
        />
        <button
          className="btn btn-outline-light btn-plain"
          type="submit"
          disabled={busy || !totpReady || code.length !== 6}
        >
          
          {t("用验证码登录")}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {recovery && (
        <>
          <h2 className="section-title">{t("紧急登录")}</h2>
          {!recoveryReady || recoveryMissing ? (
            <p className="notice">{t(RECOVERY_SETUP_HINT)}</p>
          ) : (
            <p className="notice">
              {needsSetup
                ? t(
                    "第一次安装还没有任何钥匙，用这个进门：填安装向导生成的 .env 里的 RECOVERY_TOKEN。进去之后立刻绑定 Passkey 和验证器。"
                  )
                : t(
                    "两把钥匙都不在手上的时候用这个：填环境变量 RECOVERY_TOKEN 的值。进来之后立刻重新绑定 Passkey 和验证器。"
                  )}
            </p>
          )}
          <form className="login-form d-flex" onSubmit={loginWithRecoveryKey}>
            <input
              className="search-input"
              type="password"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder={t("紧急密钥")}
              aria-label={t("紧急密钥")}
              autoComplete="off"
              disabled={!recoveryReady || recoveryMissing}
            />
            <button
              className="btn btn-outline-light btn-plain"
              type="submit"
              disabled={
                busy ||
                !recoveryReady ||
                recoveryMissing ||
                recoveryKey.length === 0
              }
            >
              {t("进入")}
            </button>
          </form>

          <div className="row g-2 align-items-center mt-3">
            <div className="col-12 col-sm-auto">
              <button
                className="btn btn-outline-light btn-plain text-nowrap"
                type="button"
                onClick={() => void generateRecoveryToken()}
              >
                {t("生成恢复密钥")}
              </button>
            </div>
            {newRecoveryToken && (
              <>
                <div className="col-12 col-sm-auto">
                  <code className="secret-key text-nowrap">
                    {masked(newRecoveryToken)}
                  </code>
                </div>
                <div className="col-12 col-sm-auto">
                  <button
                    className="btn btn-outline-light btn-plain text-nowrap"
                    type="button"
                    onClick={() => void copyRecoveryToken()}
                  >
                    {copied ? t("已复制") : t("复制")}
                  </button>
                </div>
              </>
            )}
          </div>
          <p className="notice">
            {t(
              "生成的密钥只显示一部分，复制出来是完整的。请把它保存到服务器 .env 的 RECOVERY_TOKEN，或导入 Vercel 环境变量，重新部署 / 重启后才生效。"
            )}
          </p>
        </>
      )}
    </section>
  );
}
