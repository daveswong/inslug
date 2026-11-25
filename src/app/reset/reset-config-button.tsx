"use client";

// 恢复页里的「重置配置」：发确认邮件，确认页点确认才真的清空
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { requestConfigResetAction } from "@/app/setup/reset-actions";

export default function ResetConfigButton({
  envWritable,
}: {
  /** 当前平台能不能改 .env 文件（Vercel 上不行，配置在环境变量里） */
  envWritable: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const request = () => {
    if (!window.confirm(t("确定要重置配置吗？会发一封确认邮件。"))) {
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

  return (
    <div className="reset-config">
      <button
        className="btn btn-outline-light btn-plain"
        type="button"
        disabled={pending}
        onClick={request}
      >
        {pending ? t("申请中…") : t("重置配置")}
      </button>
      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
      {!envWritable && (
        <p className="notice">
          {t(
            "当前平台写不了 .env 文件（配置在平台的环境变量里），应用只能清掉存在数据库里的那部分；剩下的变量会列出来，需要你手动去平台控制台删。"
          )}
        </p>
      )}
    </div>
  );
}
