"use client";

// 恢复页：生成一把临时密钥，用户自己复制到服务端配置
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { generateRecoveryToken } from "./recovery-actions";

export default function RecoveryTokenPanel() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const generate = () => {
    setError("");
    setCopied(false);
    startTransition(async () => {
      const result = await generateRecoveryToken();
      if (!result.ok) {
        setError(result.error ?? t("生成失败"));
        return;
      }
      setToken(result.token);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setError(t("复制失败，请手动选中复制"));
    }
  };

  return (
    <div className="recovery-panel">
      <button
        className="btn btn-outline-light btn-plain"
        type="button"
        disabled={pending}
        onClick={generate}
      >
        {pending ? t("生成中…") : token ? t("重新生成") : t("生成临时密钥")}
      </button>

      {token && (
        <>
          <p className="notice">{t("复制后自己去服务器配置，页面不会保存它。")}</p>
          <pre className="secret-key">{token}</pre>
          <div className="form-actions">
            <button
              className="btn btn-outline-light btn-plain"
              type="button"
              onClick={copy}
            >
              {copied ? t("已复制") : t("复制")}
            </button>
          </div>
          <p className="notice">
            {t("进去后立刻重新绑定 Passkey 和验证器，再把这把临时密钥删掉。")}
          </p>
        </>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
