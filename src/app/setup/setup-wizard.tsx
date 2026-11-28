"use client";

/**
 * 安装向导：只有一步——配置服务器环境变量。
 *
 * 配置齐全就算安装完成：「检查配置，完成安装」先校验服务端实时配置，
 * 通过则标记初始化完成，跳到登录页。邮箱通知、Passkey、验证器都不在安装流程里，
 * 首次登录后到站点设置里配。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConfigField } from "@/lib/config-keys";
import type { DatabaseStatus } from "@/lib/mongodb";
import { useT } from "@/components/i18n-provider";
import type { ServiceFeature } from "@/components/service-config-fields";
import AuthConfigPanel from "./auth-config-panel";
import { checkSetupReady } from "./config-actions";
import { generateSecretsAction } from "./secrets-actions";
import { RECOVERY_DELETE_HINT_BRIEF } from "@/lib/recovery-hints";

type Props = {
  /** 身份验证与启动必需的变量（手填的那些） */
  authItems: ConfigField[];
  /** 邮件与文件存储的配置（按方案分组） */
  serviceFeatures: ServiceFeature[];
  /** 能不能写配置文件（写不了就不提供「配置文件」这个选项） */
  fileWritable: boolean;
  onVercel: boolean;
  /** 当前库的状态：存在还是刚建的 */
  dbStatus: DatabaseStatus | null;
  /** 有没有配数据库地址 */
  dbConfigured: boolean;
  /** 服务器实际读到的 Passkey 域名主体 */
  rpId: string;
  /** 服务器实际读到的站点地址 */
  origin: string;
  /** 这次请求是从哪个域名进来的 */
  requestHost: string;
  /** RP_ID 与当前域名是否对得上（浏览器的要求：相等或是它的可注册域后缀） */
  rpIdMatchesHost: boolean;
  /** ORIGIN 里的主机名 */
  originHost: string;
  /** 数据库连上了但读不到凭据：这时不能免登录，得跟站长说清楚 */
  credentialProbeFailed: boolean;
};

type Secrets = { authSecret: string; recoveryToken: string };

/** 值里有空格、# 或引号就加引号，保证生成的 .env 能正确解析 */
function formatValue(value: string): string {
  return /[\s#"'`\\]/.test(value) || value === ""
    ? `"${value.replace(/"/g, '\\"')}"`
    : value;
}

export default function SetupWizard({
  authItems,
  serviceFeatures,
  fileWritable,
  onVercel,
  dbStatus,
  dbConfigured,
  rpId,
  origin,
  requestHost,
  rpIdMatchesHost,
  originHost,
  credentialProbeFailed,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkDone, setCheckDone] = useState(false);

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
  const [pending, startTransition] = useTransition();
  const [envError, setEnvError] = useState("");

  /**
   * 底部「生成 .env 文件」的必填判断：和 checkSetupReady 的服务端口径对齐。
   * - 手填：数据库串、库名、域名主体、站点地址（已配置的算填过）
   * - 发信：按当前选的 provider 要它的必填字段；文件存储不算必填
   * 只用来决定按钮能不能点，真正的放行还是服务端检查配置那一步。
   */
  const fieldFilled = (key: string): boolean => {
    const item = authItems.find((entry) => entry.key === key);
    return Boolean(item?.configured || (values[key] ?? "").trim());
  };
  const serviceFieldFilled = (key: string): boolean => {
    const feature = serviceFeatures.find((entry) =>
      entry.fields.some((field) => field.key === key)
    );
    const field = feature?.fields.find((entry) => entry.key === key);
    return Boolean(field?.configured || (serviceValues[key] ?? "").trim());
  };
  const mailFeature = serviceFeatures.find((feature) => feature.id === "mail");
  const mailChoice = mailFeature
    ? serviceValues[mailFeature.choiceKey] ||
      mailFeature.current ||
      mailFeature.providers[0]?.value ||
      ""
    : "";
  const mailRequired =
    mailChoice === "smtp"
      ? ["SMTP_HOST", "SMTP_FROM"]
      : ["RESEND_API_KEY", "RESEND_FROM"];
  const canGenerate =
    ["MONGODB_URI", "MONGODB_DB_NAME", "RP_ID", "ORIGIN"].every(fieldFilled) &&
    mailRequired.every(serviceFieldFilled);

  /**
   * 所有手填字段的当前值。
   * 下拉项没手动改过时用服务器上生效的值；写不了文件的平台上退到第一个选项。
   */
  const currentValues = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const item of authItems) {
      const fallback = item.options
        ? item.value || item.options[0]?.value || ""
        : "";
      out[item.key] = values[item.key] ?? fallback;
    }
    return out;
  };

  /** 把所有值拼成 .env 的内容，密钥现生成、不回显 */
  const buildEnvFile = async (): Promise<string> => {
    let result: Awaited<ReturnType<typeof generateSecretsAction>>;
    try {
      result = await generateSecretsAction();
    } catch {
      throw new Error(t("生成失败"));
    }
    const sec: Secrets = {
      authSecret: result.authSecret,
      recoveryToken: result.recoveryToken,
    };
    const lines: string[] = [
      "# inslog 的服务器配置",
      "# 请保存到服务器项目根目录，或导入到 Vercel → Settings → Environment Variables",
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

  /** 底部按钮：现生成密钥并下载 .env，不回显、绝不写服务器环境变量 */
  const generateEnv = () => {
    if (!canGenerate) return;
    setEnvError("");
    startTransition(async () => {
      try {
        const content = await buildEnvFile();
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = ".env";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        setEnvError(e instanceof Error ? e.message : t("生成失败"));
      }
    });
  };

  /**
   * 「检查配置，完成安装」：读服务端实时配置（不是输入框里的草稿）。
   * 齐全则标记安装完成，跳登录页——邮箱、Passkey、验证器都留到登录后去设置页配。
   */
  const checkConfig = async () => {
    setBusy(true);
    setError("");
    setCheckDone(false);
    try {
      const res = await checkSetupReady();
      if (!res.ok) {
        setError(
          t("配置未生效：{items}。请保存 .env 并重启 / 重新部署。", {
            items: res.missing.join("、"),
          })
        );
        return;
      }
      const done = await fetch("/api/setup/complete", { method: "POST" });
      const data = await done.json();
      if (!done.ok) throw new Error(data.error ?? t("保存失败"));
      // 先给出结果，再跳转，让用户看清检查通过。
      setCheckDone(true);
      setTimeout(() => {
        // 首次没有钥匙，用紧急密钥进门；登录后直达设置页配邮箱和身份验证。
        router.push("/login?recovery=1&next=/settings&welcome=1");
        router.refresh();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("检查配置失败"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      {credentialProbeFailed && (
        <p className="form-error">
          {t(
            "数据库连上了但读不到登录凭据：可能是数据库用户的权限不够。为了安全起见，这时不能免登录修改配置——先修好数据库权限再回来。"
          )}
        </p>
      )}
      <AuthConfigPanel
        manualItems={authItems}
        fileWritable={fileWritable}
        serviceFeatures={serviceFeatures}
        values={values}
        onValuesChange={setValues}
        serviceValues={serviceValues}
        onServiceValuesChange={setServiceValues}
      />

      <ol className="reset-steps">
        <li>{t("填好各项，下载生成的 .env。")}</li>
        <li>
          {onVercel
            ? t("到 Vercel 项目 → Settings → Environment Variables，上传这个 .env 文件。")
            : t("把下载的 .env 保存到服务器项目根目录，不要提交 Git。")}
        </li>
        <li>
          {onVercel
            ? t("重新部署并等待完成，然后刷新本页。")
            : t("重启服务并刷新本页。")}
        </li>
        <li>
          {t("刷新后的页面点「检查配置，完成安装」，通过后会跳到登录页。")}
        </li>
      </ol>

      {(rpId || origin) && (
        <dl className="confirm-meta row gx-4 gy-1 my-4">
          <dt className="col-12 col-sm-3">{t("当前域名")}</dt>
          <dd className="col-12 col-sm-9">{requestHost || t("（未知）")}</dd>
          <dt className="col-12 col-sm-3">RP_ID</dt>
          <dd className="col-12 col-sm-9">{rpId || t("（未配置）")}</dd>
          <dt className="col-12 col-sm-3">ORIGIN</dt>
          <dd className="col-12 col-sm-9">{origin || t("（未配置）")}</dd>
        </dl>
      )}

      {!!rpId && !rpIdMatchesHost && (
        <p className="form-error">
          {t(
            "RP_ID 和当前域名对不上，浏览器会拒绝绑定 Passkey。RP_ID 要填当前域名本身，或者它的上级可注册域，不能带 https://、端口或路径。"
          )}
          {" "}
          {requestHost
            ? t("按当前域名，应填：{host}", { host: requestHost })
            : t("改成当前站点的域名，不带协议。")}
        </p>
      )}

      {!!originHost && requestHost && originHost !== requestHost && (
        <p className="form-error">
          {t(
            "ORIGIN 与当前域名不符，确认邮件链接会指向别处。应填 https://{host}",
            { host: requestHost }
          )}
        </p>
      )}

      {dbStatus ? (
        <p className="notice">
          {dbStatus.created
            ? t("数据库 {name} 已创建，连得上。", { name: dbStatus.dbName })
            : t("数据库 {name} 连得上，里面有 {n} 篇文章。", {
                name: dbStatus.dbName,
                n: String(dbStatus.postCount),
              })}
        </p>
      ) : (
        dbConfigured && (
          <p className="form-error">
            {t(
              "地址填了，但连不上。查两处：连接串里的用户名密码对不对，Atlas 的 Network Access 里有没有放行当前出口 IP（加上 0.0.0.0/0 最省事）。改完 .env 后要重新部署或重启，然后再刷新本页。"
            )}
          </p>
        )
      )}

      {envError && <p className="form-error">{envError}</p>}
      {error && <p className="form-error">{error}</p>}
      {checkDone && <p className="notice">{t("检查通过，正在跳转到登录页…")}</p>}

      <div className="setup-nav d-flex flex-wrap align-items-center">
        <button
          className="btn btn-outline-light btn-plain"
          type="button"
          disabled={!canGenerate || pending || busy || checkDone}
          onClick={generateEnv}
        >
          {pending ? t("生成中…") : t("生成 .env 文件")}
        </button>
        {dbConfigured && (
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            disabled={busy || pending || checkDone}
            onClick={() => void checkConfig()}
          >
            {busy ? t("检查中…") : t("检查配置，完成安装")}
          </button>
        )}
      </div>

      <p className="field-hint">{t(RECOVERY_DELETE_HINT_BRIEF)}</p>
    </section>
  );
}
