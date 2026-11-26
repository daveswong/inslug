"use client";

/**
 * 配置项编辑器：输入框 + 保存。
 *
 * 已配置的项只显示「已配置」，不把值回显到前端——这些是数据库密码和密钥，
 * 显示出来等于公开。敏感项用 password 类型输入。
 *
 * 服务端：auth 组（身份验证与启动必需）只���在安装 / 重置引导里出现；
 * service 组（邮件、图片存储）还可以在设置页里改。
 */
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";

export type ConfigField = {
  key: string;
  label: string;
  hint: string;
  secret: boolean;
  configured: boolean;
  /** 枚举型配置：给候选项，渲染成下拉 */
  options?: { value: string; label: string }[];
  /** 当前生效的值；下拉的初始选中项用它 */
  value?: string;
};

type Props = {
  items: ConfigField[];
  /** 传进来的保存动作，返回错误信息就显示出来 */
  onSave: (values: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
  /** 保存成功后的提示文案 */
  successHint: string;
};

export default function ConfigFields({ items, onSave, successHint }: Props) {
  const t = useT();
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    setStatus("");
    setError("");
    startTransition(async () => {
      const result = await onSave(values);
      if (!result.ok) {
        setError(result.error ?? t("保存失败"));
        return;
      }
      setStatus(successHint);
      setValues({});
    });
  };

  if (!items.length) return null;

  return (
    <div className="config-fields">
      {items.map((item) => (
        <div className="config-item" key={item.key}>
          <div className="config-item-head">
            <span className="config-item-label">{item.label}</span>
            <code className="config-item-key">{item.key}</code>
            {item.configured ? (
              <span className="config-item-state">{t("已配置")}</span>
            ) : (
              <span className="config-item-state config-item-missing">
                {t("未配置")}
              </span>
            )}
          </div>
          {item.configured ? (
            <p className="field-hint">{item.hint}</p>
          ) : (
            <>
              <input
                className="search-input"
                type={item.secret ? "password" : "text"}
                value={values[item.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [item.key]: e.target.value })
                }
                placeholder={item.secret ? t("输入新的值") : item.hint}
                autoComplete="off"
              />
              <p className="field-hint">{item.hint}</p>
            </>
          )}
        </div>
      ))}

      <button
        className="btn btn-outline-light btn-plain"
        type="button"
        disabled={pending || Object.keys(values).length === 0}
        onClick={save}
      >
        {pending ? t("保存中…") : t("保存")}
      </button>

      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
