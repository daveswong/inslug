"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

type Props = {
  loggedIn: boolean;
  next: string;
};

export default function LoginForm({ loggedIn, next }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = () => {
    router.replace(next);
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

  const loginWithPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
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

      <p className="notice">Passkey 不在手边时，用后备密码。</p>
      <form className="login-form" onSubmit={loginWithPassword}>
        <input
          className="search-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="后备密码"
          aria-label="后备密码"
          autoComplete="current-password"
        />
        <button
          className="btn btn-outline-light btn-plain"
          type="submit"
          disabled={busy || password.length === 0}
        >
          用密码登录
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
