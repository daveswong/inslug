"use client";

/**
 * 安装向导：只有一步——配置服务器环境变量。
 *
 * 配置齐全就算安装完成：「检查配置，完成安装」先校验服务端实时配置，
 * 通过则标记初始化完成，跳到登录页。邮箱通知、Passkey、验证器都不在安装流程里，
 * 首次登录后到站点设置里配。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfigField } from "@/lib/config-keys";
import type { DatabaseStatus } from "@/lib/mongodb";
import { useT } from "@/components/i18n-provider";
import type { ServiceFeature } from "@/components/service-config-fields";
import AuthConfigPanel, { type GeneratedItem } from "./auth-config-panel";
import { checkSetupReady } from "./config-actions";

type Props = {
  /** 身份验证与启动必需的变量（手填的那些） */
  authItems: ConfigField[];
  /** 由程序生成的密钥 */
  generatedAuthItems: GeneratedItem[];
  /** 邮件与文件存储的配置（按方案分组） */
  serviceFeatures: ServiceFeature[];
  /** 能不能写 .env 文件（Vercel 上不行） */
  envWritable: boolean;
  /** 能不能写配置文件（写不了就不提供「配置文件」这个选项） */
  fileWritable: boolean;
  onVercel: boolean;
  /** 当前库的状态：存在还是刚建的 */
  dbStatus: DatabaseStatus | null;
  /** 有没有配数据库地址 */
  dbConfigured: boolean;
  /** 服务器上有没有生效的 RECOVERY_TOKEN（Vercel 上要导入 .env 并重新部署之后才有） */
  recoveryReady: boolean;
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

export default function SetupWizard({
  authItems,
  generatedAuthItems,
  serviceFeatures,
  envWritable,
  fileWritable,
  onVercel,
  dbStatus,
  dbConfigured,
  recoveryReady,
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

  /**
   * 「检查配置，完成安装」：读服务端实时配置（不是输入框里的草稿）。
   * 齐全则标记安装完成，跳登录页——邮箱、Passkey、验证器都留到登录后去设置页配。
   */
  const checkConfig = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await checkSetupReady();
      if (!res.ok) {
        setError(
          t("还有必填配置没生效：{items}。填好后请先保存，再往下走。", {
            items: res.missing.join("、"),
          })
        );
        return;
      }
      const done = await fetch("/api/setup/complete", { method: "POST" });
      const data = await done.json();
      if (!done.ok) throw new Error(data.error ?? t("保存失败"));
      // 首次没有钥匙，用紧急密钥进门；登录后直达设置页配邮箱和身份验证。
      router.push("/login?recovery=1&next=/settings&welcome=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("检查配置失败"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <h2 className="section-title">{t("身份验证与启动配置")}</h2>
      {credentialProbeFailed && (
        <p className="form-error">
          {t(
            "数据库连上了但读不到登录凭据：可能是数据库用户的权限不够。为了安全起见，这时不能免登录修改配置——先修好数据库权限再回来。"
          )}
        </p>
      )}
      <p className="notice">
        {onVercel
          ? t("Vercel 不能写文件：下载 .env 后导入环境变量，再重新部署。")
          : t("写入项目根目录的 .env，不进 Git。")}
      </p>
      <p className="notice">
        {t(
          "配置完成后会跳到登录页。首次请用 .env 里的 RECOVERY_TOKEN 从紧急入口进入。"
        )}
      </p>
      <AuthConfigPanel
        manualItems={authItems}
        generatedItems={generatedAuthItems}
        envWritable={envWritable}
        fileWritable={fileWritable}
        serviceFeatures={serviceFeatures}
      />

      {!recoveryReady && (
        <p className="notice">
          {t(
            "配置尚未生效：Vercel 需导入 .env 并重新部署，之后紧急登录才可用。"
          )}
        </p>
      )}

      {onVercel && (
        <ol className="reset-steps">
          <li>{t("填好各项，下载生成的 .env。")}</li>
          <li>
            {t(
              "到 Vercel 项目 → Settings → Environment Variables，上传这个 .env 文件。"
            )}
          </li>
          <li>{t("重新部署并等待完成。")}</li>
          <li>
            {t("回到本页点「检查配置，完成安装」，通过后会跳到登录页。")}
          </li>
        </ol>
      )}

      {(rpId || origin) && (
        <dl className="confirm-meta">
          <dt>{t("当前域名")}</dt>
          <dd>{requestHost || t("（未知）")}</dd>
          <dt>RP_ID</dt>
          <dd>{rpId || t("（未配置）")}</dd>
          <dt>ORIGIN</dt>
          <dd>{origin || t("（未配置）")}</dd>
        </dl>
      )}

      {!!rpId && !rpIdMatchesHost && (
        <p className="form-error">
          {t(
            "RP_ID 和当前域名对不上，浏览器会拒绝绑定 Passkey（报错是 The RP ID \"...\" is invalid for this domain）。RP_ID 要填当前域名本身，或者它的上级可注册域，不能带 https://、端口或路径。"
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
              "地址填了，但连不上。查两处：连接串里的用户名密码对不对，Atlas 的 Network Access 里有没有放行当前出口 IP（加上 0.0.0.0/0 最省事）。改完刷新本页就行，不用重新部署。"
            )}
          </p>
        )
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="setup-nav">
        <button
          className="btn btn-outline-light btn-plain"
          type="button"
          disabled={busy}
          onClick={() => void checkConfig()}
        >
          {busy ? t("检查中…") : t("检查配置，完成安装")}
        </button>
      </div>
    </section>
  );
}
