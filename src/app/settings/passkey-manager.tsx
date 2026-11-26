"use client";

/**
 * Passkey 管理：列出已绑设备、申请删除、申请新增。
 *
 * 新增和删除都要过邮件确认：
 * - 删除：确认页点下去才真删，并让所有旧会话失效
 * - 新增：确认页只开一个 10 分钟窗口，真正绑定还得本人在设备上做 WebAuthn
 */
import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useT } from "@/components/i18n-provider";

export type PasskeyView = {
  credentialId: string;
  createdAt: string;
  lastUsedAt: string | null;
  transports: string[];
};

type Props = {
  passkeys: PasskeyView[];
  /** 邮件确认后开启的绑定窗口是否仍有效 */
  authorized: boolean;
  mailReady: boolean;
  onBound?: () => void;
};

export default function PasskeyManager({
  passkeys,
  authorized,
  mailReady,
  onBound,
}: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const requestAdd = async () => {
    setBusy(true);
    setError("");
    setStatus(t("正在申请…"));
    try {
      const res = await fetch("/api/auth/passkey/add-request", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("申请失败"));
      setStatus(
        data.pending
          ? t("确认信已发出：点邮件里的链接，再回这页点「完成绑定」。")
          : t("授权还在有效期内，可以完成绑定。")
      );
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : t("申请失败"));
    } finally {
      setBusy(false);
    }
  };

  const bind = async () => {
    setBusy(true);
    setError("");
    setStatus(t("正在请求浏览器…"));
    try {
      if (!window.isSecureContext) {
        throw new Error(t("Passkey 需要 HTTPS 或 localhost 环境，当前页面不满足"));
      }
      const optionsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? t("无法开始绑定"));

      setStatus(t("等待系统弹窗确认（Touch ID / 指纹 / 设备密码）…"));
      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error ?? t("绑定失败"));

      setStatus(`已绑定，现在共 ${data.count} 把。`);
      onBound?.();
    } catch (e) {
      setStatus("");
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError") {
        setError(
          t("浏览器没有放行：可能取消了确认，或页面嵌在别的窗口里。请在独立的浏览器标签页打开本站再试。")
        );
      } else {
        setError(e instanceof Error ? e.message : t("绑定失败"));
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (credentialId: string) => {
    if (!window.confirm(t("确定删除这把 Passkey？需要邮件确认后才会生效。"))) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/auth/passkey/remove-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credentialId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("申请失败"));
      setStatus(t("确认信已发出：点邮件里的链接、点一下确认，删除才会生效。"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("申请失败"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="passkey-manager">
      {passkeys.length === 0 ? (
        <p className="notice">{t("还没有绑定 Passkey。")}</p>
      ) : (
        <ul className="passkey-list">
          {passkeys.map((key) => (
            <li key={key.credentialId}>
              <span>
                {key.credentialId.slice(0, 12)}{t("… · 绑于")} {key.createdAt.slice(0, 10)}
                {key.lastUsedAt && ` · 最近使用 ${key.lastUsedAt.slice(0, 10)}`}
              </span>
              <button
                className="btn btn-outline-light btn-plain"
                type="button"
                disabled={busy || !mailReady}
                onClick={() => remove(key.credentialId)}
              >
                
                {t("删除")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {authorized ? (
        <button
          className="btn btn-outline-light btn-plain"
          type="button"
          disabled={busy}
          onClick={bind}
        >
          
          {t("完成绑定（授权 10 分钟内有效）")}
        </button>
      ) : (
        <button
          className="btn btn-outline-light btn-plain"
          type="button"
          disabled={busy || !mailReady}
          onClick={requestAdd}
        >
          
          {t("申请绑定新的 Passkey")}
        </button>
      )}

      {!mailReady && (
        <p className="notice">
          
          {t("增删 Passkey 需邮件确认。请先配置服务端发信，并在站点设置里填好通知邮箱。")}
        </p>
      )}
      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
