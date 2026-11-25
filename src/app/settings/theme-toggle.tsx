"use client";

/** 外观：跟随系统 / 浅色 / 深色。选择存在 localStorage，刷新时由 layout 的内联脚本提前应用。 */
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

export default function ThemeToggle() {
  const t = useT();
  const OPTIONS = [
    { value: "auto", label: t("跟随系统") },
    { value: "light", label: t("浅色") },
    { value: "dark", label: t("深色") },
  ];
  const [value, setValue] = useState("auto");

  useEffect(() => {
    try {
      setValue(localStorage.getItem("inslog-theme") ?? "auto");
    } catch {
      setValue("auto");
    }
  }, []);

  const choose = (next: string) => {
    setValue(next);
    try {
      if (next === "auto") localStorage.removeItem("inslog-theme");
      else localStorage.setItem("inslog-theme", next);
    } catch {
      // 隐私模式下 localStorage 不可用，只影响本次页面
    }
    if (next === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  };

  return (
    <div className="tag-list">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          className={`visibility-option ${value === option.value ? "selected" : ""}`}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
