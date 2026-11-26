"use client";

/**
 * 安装 / 重置引导里的身份验证配置。
 *
 * 两个平台走同一套表单：
 * - 自部署：填完直接写进项目根目录的 .env
 * - Vercel：文件系统只读，填完打包成一个 .env 文件下载，用户自己导入到
 *   Vercel 的环境变量里（Vercel 支持直接上传 .env）
 *
 * AUTH_SECRET 与 RECOVERY_TOKEN 由程序生成，不让人手写：
 * 长度够、不出人为弱口令、特殊字符不用自己转义。
 */
import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import type { ConfigField } from "@/components/config-fields";
import ServiceConfigFields, {
  type ServiceFeature,
} from "@/components/service-config-fields";
import { generateSecretsAction } from "./secrets-actions";
import { saveAuthConfig } from "./config-actions";

export type GeneratedItem = {
  key: string;
  label: string;
  configured: boolean;
};

type Props = {
  /** 手填的项：数据库地址、库名、域名这些 */
  manualItems: ConfigField[];
  /** 程序生成的密钥（显示状态用） */
  generatedItems: GeneratedItem[];
  /** 当前平台能不能直接写 .env */
  envWritable: boolean;
  /** 邮件与图片存储的方案与字段，和 auth 字段一起保存 */
  serviceFeatures: ServiceFeature[];
  /** 文件系统能不能写配置文件（写不了就不提供「配置文件」这个选项） */
  fileWritable: boolean;
};

type Secrets = { authSecret: string; recoveryToken: string };

/** 值里有空格、# 或引号就加引号，跟服务端写 .env 的规则一致 */
function formatValue(value: string): string {
  return /[\s#"'`\\]/.test(value) || value === ""
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
}

export default function AuthConfigPanel({
  manualItems,
  generatedItems,
  envWritable,
  serviceFeatures,
  fileWritable,
}: Props) {
  const t = useT();
  const [values, setValues] = useState<Record<string, string>>({});
  const [serviceValues, setServiceValues] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        serviceFeatures.map((feature) => [
          feature.choiceKey,
          feature.current || feature.providers[0]?.value || "",
        ])
      )
  );
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const labelOf = (key: string) =>
    manualItems.find((item) => item.key === key)?.label ??
    generatedItems.find((item) => item.key === key)?.label ??
    key;

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
          <div className="config-item-head">
            <span className="config-item-label">{item.label}</span>
            <code className="config-item-key">{item.key}</code>
          </div>
          <select
            className="search-input"
            value={current}
            onChange={(e) =>
              setValues({ ...values, [item.key]: e.target.value })
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
        <input
          className="search-input"
          type={item.secret ? "password" : "text"}
          value={values[item.key] ?? ""}
          onChange={(e) => setValues({ ...values, [item.key]: e.target.value })}
          placeholder={item.secret ? t("输入新的值") : item.hint}
          autoComplete="off"
        />
        <p className="field-hint">{item.hint}</p>
      </div>
    );
  };

  /** 生成两把密钥（自部署会顺手写进 .env） */
  const generate = (): Promise<Secrets | null> =>
    generateSecretsAction().then((result) => {
      if (!result.ok) {
        setError(result.error ?? t("生成失败"));
        return null;
      }
      const next = {
        authSecret: result.authSecret,
        recoveryToken: result.recoveryToken,
      };
      setSecrets(next);
      return next;
    });

  /**
   * 所有手填字段的当前值。
   * 下拉项没手动改过时用服务器上生效的值；写不了文件的平台上退到第一个选项。
   */
  const currentValues = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const item of manualItems) {
      const fallback = item.options
        ? item.value || item.options[0]?.value || ""
        : "";
      out[item.key] = values[item.key] ?? fallback;
    }
    return out;
  };

  /** 把所有值拼成 .env 的内容 */
  const buildEnvFile = (sec: Secrets): string => {
    const lines: string[] = [
      "# inslog 的服务器配置",
      "# 导入到 Vercel：项目 → Settings → Environment Variables → 上传这个文件",
      "",
    ];
    const all: [string, string][] = [
      ...Object.entries(currentValues()),
      ["AUTH_SECRET", sec.authSecret],
      ["RECOVERY_TOKEN", sec.recoveryToken],
      ...Object.entries(serviceValues),
    ];
    for (const [key, value] of all) {
      if (!value) continue;
      lines.push(`${key}=${formatValue(value)}`);
    }
    return lines.join("\n") + "\n";
  };

  const download = (content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = ".env";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /** 主按钮：自部署写文件，Vercel 下载文件 */
  const primary = () => {
    setStatus("");
    setError("");
    startTransition(async () => {
      let sec = secrets;
      if (!sec) {
        const generated = await generate();
        if (!generated) return;
        sec = generated;
      }

      if (envWritable) {
        const result = await saveAuthConfig({
          ...currentValues(),
          AUTH_SECRET: sec.authSecret,
          RECOVERY_TOKEN: sec.recoveryToken,
          ...serviceValues,
        });
        if (!result.ok) {
          setError(result.error ?? t("保存失败"));
          return;
        }
        setStatus(t("已写入 .env，刷新后生效。"));
        // 顺手也给一份备份，省得以后想找原始配置时找不着
        download(buildEnvFile(sec));
        return;
      }

      // Vercel：打包成 .env 让用户下载
      download(buildEnvFile(sec));
      setStatus(
        t(
          "已下载 .env 文件。把它导入到 Vercel 的环境变量里（项目 → Settings → Environment Variables → 上传），然后重新部署。"
        )
      );
    });
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

      <h3 className="form-group">{t("密钥")}</h3>
      <p className="notice">
        {t(
          "程序生成，请存进密码管理器。"
        )}
      </p>

      <div className="secret-actions">
        <button
          className="btn btn-outline-light btn-plain"
          type="button"
          disabled={pending}
          onClick={() => {
            setStatus("");
            setError("");
            startTransition(async () => {
              await generate();
            });
          }}
        >
          {pending ? t("生成中…") : secrets ? t("重新生成") : t("生成密钥")}
        </button>

        <button
          className="btn btn-outline-light btn-plain"
          type="button"
          disabled={pending}
          onClick={primary}
        >
          {envWritable ? t("保存到 .env") : t("生成 .env 文件")}
        </button>
      </div>

      {secrets && (
        <ul className="secret-list">
          {(["AUTH_SECRET", "RECOVERY_TOKEN"] as const).map((key) => (
            <li key={key}>
              <span className="secret-label">{labelOf(key)}</span>
              <code className="secret-key">
                {key === "AUTH_SECRET" ? secrets.authSecret : secrets.recoveryToken}
              </code>
            </li>
          ))}
        </ul>
      )}

      <h3 className="form-group">{t("邮件与图片存储")}</h3>
      <ServiceConfigFields
        features={serviceFeatures}
        values={serviceValues}
        onChange={setServiceValues}
      />

      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
