"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

/**
 * 登录：Passkey 与验证器二选一。
 *
 * 没有密码了——密码能猜、能撞、能忘，换来的安全性还不如一把 Passkey。
 * 紧急入口（登录页加 ?recovery=1）只在两把钥匙都丢了时用，密钥在环境变量
 * RECOVERY_TOKEN 里，进来之后应当立刻重新绑定验证器并把这个变量删掉。
 */

type Props = {
  loggedIn: boolean;
  next: string;
  /** 带 ?recovery=1 时才显示紧急入口，平时不占版面 */
  recovery: boolean;
  /** 初始化没走完时，从首页登录直接送去安装向导 */
  needsSetup: boolean;
};

export default function LoginForm({
  loggedIn,
  next,
  recovery,
  needsSetup,
}: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = () => {
    // 只有目标是首页时才改道；从中间件跳来的 ?next=/settings 保持原样
    const target = needsSetup && (next === "/" || next === "") ? "/setup" : next;
    router.replace(target);
    router.refresh();
  };

  const loginWithPasskey = async () => {
    setBusy(true);
    setError("");
    try {
      const optionsRes = await fetch("/api/auth/passkey/login/options");
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? "无法开始 Passkey 登录");

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error ?? "验证失败");
      go();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const loginWithCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/totp/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登录失败");
      go();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const loginWithRecoveryKey = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: recoveryKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登录失败");
      go();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  if (loggedIn) {
    return (
      <section className="section">
        <p className="notice">已经登录了。</p>
        <div className="tag-list">
          <a href="/">返回首页</a>
          <a href="/write">写文章</a>
          <a href="/settings">站点设置</a>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <button
        className="btn btn-outline-light btn-plain"
        type="button"
        disabled={busy}
        onClick={loginWithPasskey}
      >
        用 Passkey 登录
      </button>

      <p className="notice">或者用手机验证器里的 6 位码。</p>
      <form className="login-form" onSubmit={loginWithCode}>
        <input
          className="search-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="6 位验证码"
          aria-label="6 位验证码"
        />
        <button
          className="btn btn-outline-light btn-plain"
          type="submit"
          disabled={busy || code.length !== 6}
        >
          用验证码登录
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {recovery && (
        <>
          <h2 className="section-title">紧急登录</h2>
          <p className="notice">
            两把钥匙都不在手上的时候用这个：填环境变量 RECOVERY_TOKEN 的值。
            进来之后立刻重新绑定验证器，然后去 Vercel 把这个变量删掉。
          </p>
          <form className="login-form" onSubmit={loginWithRecoveryKey}>
            <input
              className="search-input"
              type="password"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="紧急密钥"
              aria-label="紧急密钥"
              autoComplete="off"
            />
            <button
              className="btn btn-outline-light btn-plain"
              type="submit"
              disabled={busy || recoveryKey.length === 0}
            >
              进入
            </button>
          </form>
        </>
      )}
    </section>
  );
}
