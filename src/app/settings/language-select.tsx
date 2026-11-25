"use client";

// 界面语言切换：直接存库，保存后整站跟着变，不用改环境变量也不用重新部署
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { saveLanguage } from "./language-actions";

// 语言名不翻译：中文界面显示「English」，英文界面也显示「English」
const OPTIONS = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "English" },
];

export default function LanguageSelect({ value }: { value: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState("");

  const change = (next: string) => {
    setCurrent(next);
    setError("");
    startTransition(async () => {
      const result = await saveLanguage(next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // 重新拉一次服务端渲染，拿到新语言包
      router.refresh();
    });
  };

  return (
    <div className="language-select">
      <div className="tag-list">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`visibility-option ${current === option.value ? "selected" : ""}`}
            type="button"
            aria-pressed={current === option.value}
            disabled={pending}
            onClick={() => change(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {pending && <span className="notice">{t("保存中…")}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
