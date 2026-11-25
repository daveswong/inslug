"use client";

// 恢复页里的「重置身份验证与启动配置」：发确认邮件，确认页点确认才真的清空
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { requestConfigResetAction } from "@/app/setup/reset-actions";

export default function ResetConfigButton({
  available,
}: {
  /** 当前平台能不能真的重置（Vercel 上没有 .env 可清） */
  available: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const request = () => {
    if (!window.confirm(t("确定要重置身份验证与启动配置吗？会发一封确认邮件。"))) {
      return;
    }
    setStatus("");
    setError("");
    startTransition(async () => {
      const result = await requestConfigResetAction();
      if (!result.ok) {
        setError(result.error ?? t("申请失败"));
          return;
      }
      setStatus(t("确认信已发出：点邮件里的链接、点一下确认，重置才会生效。"));
      router.refresh();
    });
  };

  if (!available) {
    return (
      <p className="notice">
        {t(
          "当前平台没有 .env 文件可清（Vercel 上配置在环境变量里），这一步只对自部署的服务器有效。"
        )}
      </p>
    );
  }

  return (
    <div className="reset-config">
      <button
        className="btn btn-outline-light btn-plain"
        type="button"
        disabled={pending}
        onClick={request}
      >
        {pending ? t("申请中…") : t("重置身份验证与启动配置")}
      </button>
      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
