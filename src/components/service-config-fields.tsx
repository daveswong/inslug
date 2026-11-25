"use client";

/**
 * 服务类配置（图片存储 / 发信）的编辑器。
 *
 * 每个功能块先选方案（provider），再只显示这个方案需要的字段——
 * 没选的那套不参与，也不必填。已配置的项只显示「已配置」，不回显值。
 */
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";

export type ServiceField = {
  key: string;
  label: string;
  hint: string;
  secret: boolean;
  configured: boolean;
  /** 属于哪个方案；没有这个值表示所有方案共用 */
  provider?: string;
};

export type ServiceFeature = {
  id: string;
  title: string;
  /** provider 选择器对应的配置键，如 STORAGE_PROVIDER */
  choiceKey: string;
  /** 当前生效的方案 */
  current: string;
  providers: { value: string; label: string }[];
  fields: ServiceField[];
};

type Props = {
  features: ServiceFeature[];
  onSave: (
    values: Record<string, string>
  ) => Promise<{ ok: boolean; error?: string }>;
  successHint: string;
};

export default function ServiceConfigFields({
  features,
  onSave,
  successHint,
}: Props) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      features.map((feature) => [
        feature.id,
        feature.current || feature.providers[0]?.value || "",
      ])
    )
  );

  const save = (feature: ServiceFeature) => {
    setStatus("");
    setError("");
    const choice = selected[feature.id] ?? "";
    const changed = Object.keys(values).length > 0 || choice !== feature.current;
    if (!changed) {
      setError(t("没有需要保存的内容"));
      return;
    }
    startTransition(async () => {
      const payload = { ...values, [feature.choiceKey]: choice };
      const result = await onSave(payload);
      if (!result.ok) {
        setError(result.error ?? t("保存失败"));
        return;
      }
      setStatus(successHint);
      setValues({});
    });
  };

  if (!features.length) return null;

  return (
    <div className="config-fields">
      {features.map((feature) => {
        const choice = selected[feature.id] ?? "";
        const visible = feature.fields.filter(
          (field) => !field.provider || field.provider === choice
        );
        const changed =
          Object.keys(values).length > 0 || choice !== feature.current;

        return (
          <fieldset className="provider-block" key={feature.id}>
            <legend className="provider-title">{feature.title}</legend>

            <label className="field">
              <span className="field-label">{t("用哪种")}</span>
              <select
                className="search-input"
                value={choice}
                onChange={(e) =>
                  setSelected({ ...selected, [feature.id]: e.target.value })
                }
              >
                {feature.providers.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>

            {visible.map((field) => (
              <div className="config-item" key={field.key}>
                <div className="config-item-head">
                  <span className="config-item-label">{field.label}</span>
                  <code className="config-item-key">{field.key}</code>
                  {field.configured ? (
                    <span className="config-item-state">{t("已配置")}</span>
                  ) : (
                    <span className="config-item-state config-item-missing">
                      {t("未配置")}
                    </span>
                  )}
                </div>
                {field.configured ? (
                  <p className="field-hint">{field.hint}</p>
                ) : (
                  <>
                    <input
                      className="search-input"
                      type={field.secret ? "password" : "text"}
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [field.key]: e.target.value })
                      }
                      placeholder={field.secret ? t("输入新的值") : field.hint}
                      autoComplete="off"
                    />
                    <p className="field-hint">{field.hint}</p>
                  </>
                )}
              </div>
            ))}

            <button
              className="btn btn-outline-light btn-plain"
              type="button"
              disabled={pending || !changed}
              onClick={() => save(feature)}
            >
              {pending ? t("保存中…") : t("保存")}
            </button>
          </fieldset>
        );
      })}

      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
