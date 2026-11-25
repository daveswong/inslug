"use client";

/**
 * 手机验证器的绑定 / 更换 / 解绑。
 *
 * 首次绑定：扫码 → 填一次 6 位码 → 直接生效（此时账号只有 Passkey，多一把钥匙不损失什么）
 * 更换 / 解绑：验过新码后还要过邮件确认，因为这两件事会让已有的钥匙失效
 */
import { useState } from "react";

type Setup = { secret: string; grouped: string; qrSvg: string };

export default function TotpManager({
  bound,
  mailReady,
  onBound,
}: {
  bound: boolean;
  mailReady: boolean;
  onBound?: () => void;
}) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setSetup(null);
    setCode("");
  };

  const begin = async () => {
    setBusy(true);
    setError("");
    setStatus("正在生成密钥…");
    try {
      const res = await fetch("/api/auth/totp/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "无法生成密钥");
      setSetup(data as Setup);
      setStatus("");
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "无法生成密钥");
    } finally {
      setBusy(false);
    }
  };

  const confirmBind = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!setup) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/auth/totp/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: setup.secret, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "绑定失败");

      if (data.pending) {
        reset();
        setStatus("确认信已发出：点邮件里的链接、点一下确认，更换才会生效。");
      } else {
        setStatus("已绑定。以后可以用这个验证器的 6 位码登录。");
        reset();
        if (onBound) {
          // 向导里：让服务端重读绑定状态，别整页刷新（会丢掉当前步骤）
          onBound();
        } else {
          // 设置页里：会话版本变了，刷新一下拿新票
          setTimeout(() => window.location.reload(), 1200);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "绑定失败");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/auth/totp/disable", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "请求失败");
      setStatus("确认信已发出：点邮件里的链接、点一下确认，解绑才会生效。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setBusy(false);
    }
  };

  // 扫码绑定中
  if (setup) {
    return (
      <div className="totp-manager">
        <p className="notice">
          用手机上的验证器（1Password、Google Authenticator、iOS 密码 App 都行）扫这个码：
        </p>
        <div className="totp-qr" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
        <p className="notice">
          扫不了就把这串密钥手输进去：<code className="totp-secret">{setup.grouped}</code>
        </p>

        <form className="login-form" onSubmit={confirmBind}>
          <input
            className="search-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="验证器上显示的 6 位码"
            aria-label="6 位验证码"
          />
          <button
            className="btn btn-outline-light btn-plain"
            type="submit"
            disabled={busy || code.length !== 6}
          >
            {bound ? "验证并请求更换" : "验证并绑定"}
          </button>
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={reset}
            disabled={busy}
          >
            取消
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="totp-manager">
      {bound ? (
        <>
          <p className="notice">已经绑了一把验证器。</p>
          <div className="tag-list">
            <button
              className="btn btn-outline-light btn-plain"
              type="button"
              onClick={begin}
              disabled={busy || !mailReady}
            >
              换一把
            </button>
            <button
              className="btn btn-outline-light btn-plain"
              type="button"
              onClick={disable}
              disabled={busy || !mailReady}
            >
              解绑
            </button>
          </div>
          {!mailReady && (
            <p className="notice">
              换绑和解绑都要过邮件确认，所以得先在服务端配好 RESEND_API_KEY、RESEND_FROM，
              并在下面「通知」里填好通知邮箱。没配之前这两个按钮不可用。
            </p>
          )}
        </>
      ) : (
        <>
          <p className="notice">还没有绑定验证器。</p>
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={begin}
            disabled={busy}
          >
            绑定验证器
          </button>
        </>
      )}

      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
