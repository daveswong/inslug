"use client";

/**
 * 服务类配置（图片存储 / 发信）的字段编辑器。
 *
 * 每个功能块先选方案（provider），再只显示这个方案需要的字段——
 * 没选的那套不参与，也不必填。只负责收集和呈现字段，保存统一由父组件的
 * 「保存到 .env / 生成 .env 文件」按钮完成。
 */
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
  /** 区块标题下的补充说明，可空 */
  note?: string;
  /** provider 选择器对应的配置键，如 STORAGE_PROVIDER */
  choiceKey: string;
  /** 当前生效的方案 */
  current: string;
  providers: { value: string; label: string }[];
  fields: ServiceField[];
};

type Props = {
  features: ServiceFeature[];
  /** 全部值，含 provider 选择器的键 */
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
};

export default function ServiceConfigFields({
  features,
  values,
  onChange,
}: Props) {
  const t = useT();
  if (!features.length) return null;

  return (
    <div className="config-fields">
      {features.map((feature) => {
        const choice =
          values[feature.choiceKey] ||
          feature.current ||
          feature.providers[0]?.value ||
          "";
        const visible = feature.fields.filter(
          (field) => !field.provider || field.provider === choice
        );

        return (
          <fieldset className="provider-block" key={feature.id}>
            <legend className="provider-title">{feature.title}</legend>

            {feature.note && <p className="field-hint">{feature.note}</p>}

            <label className="field">
              <span className="field-label">{t("用哪种")}</span>
              <select
                className="search-input"
                value={choice}
                onChange={(e) =>
                  onChange({ ...values, [feature.choiceKey]: e.target.value })
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
                  {field.configured && (
                    <span className="config-item-state">{t("已配置")}</span>
                  )}
                </div>
                <input
                  className="search-input"
                  type={field.secret ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    onChange({ ...values, [field.key]: e.target.value })
                  }
                  placeholder={field.secret ? t("留空表示不改") : field.hint}
                  autoComplete="off"
                />
                <p className="field-hint">{field.hint}</p>
              </div>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
