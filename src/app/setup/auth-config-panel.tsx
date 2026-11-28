"use client";

/**
 * 安装引导里的身份验证配置。
 *
 * 所有平台走同一套表单：填完由底部按钮生成 .env 文件下载，由用户自行保存到服务器
 * 或导入平台的环境变量后台。程序不会把任何值写进服务器环境变量。
 *
 * AUTH_SECRET 与 RECOVERY_TOKEN 在下载 .env 时自动生成：长度够、不出人为弱口令、
 * 特殊字符不用自己转义。密钥只写进下载的文件，页面不显示，也不落盘。
 */
import { useT } from "@/components/i18n-provider";
import type { ConfigField } from "@/lib/config-keys";
import ServiceConfigFields, {
  type ServiceFeature,
} from "@/components/service-config-fields";

type Props = {
  /** 手填的项：数据库地址、库名、域名这些 */
  manualItems: ConfigField[];
  /** 邮件与图片存储的方案与字段，和 auth 字段一起写进 .env */
  serviceFeatures: ServiceFeature[];
  /** 文件系统能不能写配置文件（写不了就不提供「配置文件」这个选项） */
  fileWritable: boolean;
  /** 表单当前值，由父组件持有，供底部按钮判断必填项是否齐全 */
  values: Record<string, string>;
  onValuesChange: (values: Record<string, string>) => void;
  serviceValues: Record<string, string>;
  onServiceValuesChange: (values: Record<string, string>) => void;
};

export default function AuthConfigPanel({
  manualItems,
  serviceFeatures,
  fileWritable,
  values,
  onValuesChange,
  serviceValues,
  onServiceValuesChange,
}: Props) {
  const t = useT();

  // 手填字段按用途分两块；键名固定，分组只是视觉上的整理
  const dbKeys = ["MONGODB_URI", "MONGODB_DB_NAME", "SETTINGS_STORE"];
  const domainKeys = ["RP_ID", "ORIGIN"];
  const dbItems = manualItems.filter((item) => dbKeys.includes(item.key));
  const domainItems = manualItems.filter((item) => domainKeys.includes(item.key));
  const renderField = (item: (typeof manualItems)[number]) => {
    // 枚举型配置（比如站点设置存哪）用下拉，不给自由输入
    if (item.options) {
      // 文件系统写不了时，「配置文件」这个选项直接不出现
      const options = fileWritable
        ? item.options
        : item.options.filter((option) => option.value !== "file");
      // 优先用服务器上当前生效的值；没有就退到第一个选项
      const current =
        values[item.key] ?? item.value ?? options[0]?.value ?? "";
      return (
        <div className="config-item" key={item.key}>
          <div className="config-item-head d-flex flex-wrap align-items-baseline">
            <span className="config-item-label">{item.label}</span>
            <code className="config-item-key">{item.key}</code>
          </div>
          <select
            className="search-input"
            value={current}
            onChange={(e) =>
              onValuesChange({ ...values, [item.key]: e.target.value })
            }
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="field-hint">
            {fileWritable ? item.hint : t("当前平台写不了文件，只能存 MongoDB。")}
          </p>
        </div>
      );
    }
    return (
      <div className="config-item" key={item.key}>
        <div className="config-item-head d-flex flex-wrap align-items-baseline">
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
        <input
          className="search-input"
          type={item.secret ? "password" : "text"}
          value={values[item.key] ?? ""}
          onChange={(e) => onValuesChange({ ...values, [item.key]: e.target.value })}
          placeholder={item.secret ? t("必填，可以从 数据库管理后台 生成") : item.hint}
          autoComplete="off"
        />
      </div>
    );
  };

  return (
    <div className="auth-config-panel">
      {dbItems.length > 0 && (
        <>
          <h3 className="form-group">{t("数据库连接")}</h3>
          {dbItems.map(renderField)}
        </>
      )}

      {domainItems.length > 0 && (
        <>
          <h3 className="form-group">{t("域名")}</h3>
          {domainItems.map(renderField)}
        </>
      )}

      <h3 className="form-group">{t("邮件与文件存储")}</h3>
      <ServiceConfigFields
        features={serviceFeatures}
        values={serviceValues}
        onChange={onServiceValuesChange}
      />
    </div>
  );
}
