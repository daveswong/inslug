"use client";

// 站点设置里的 Passkey 管理：把当前设备（Face ID / 指纹 / Windows Hello）绑成登录凭据
import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

export default function PasskeyManager({
  onBound,
}: { onBound?: () => void } = {}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const bind = async () => {
    setBusy(true);
    setError("");
    setStatus("正在请求浏览器…");
    try {
      // WebAuthn 只在 https 或 localhost 下可用
      if (!window.isSecureContext) {
        throw new Error("Passkey 需要 HTTPS 或 localhost 环境，当前页面不满足");
      }

      const optionsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? "无法开始绑定");

      setStatus("等待系统弹窗确认（Touch ID / 指纹 / 设备密码）…");
      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error ?? "绑定失败");

      setStatus(`已绑定，这台设备以后可以直接用 Passkey 登录（共 ${data.count} 把）`);
      onBound?.();
    } catch (e) {
      setStatus("");
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError") {
        setError(
          "浏览器没有放行：可能是你取消了确认，或页面被嵌在别的窗口里（嵌入窗口通常禁止 WebAuthn）。请在独立的浏览器标签页里打开本站再试。"
        );
      } else {
        setError(e instanceof Error ? e.message : "绑定失败");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="passkey-manager">
      <button
        className="btn btn-outline-light btn-plain"
        type="button"
        disabled={busy}
        onClick={bind}
      >
        绑定这台设备的 Passkey
      </button>
      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
