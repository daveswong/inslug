/**
 * 可以引导配置的变量清单。
 *
 * 分两组：
 * - auth：身份验证与启动必需（数据库、会话密钥、紧急密钥、Passkey 域名、站点地址）。
 *   只在安装 / 重置引导里设置，设置页不提供修改入口——改了等于换锁。
 * - service：邮件与图片存储的凭据。部署之后随时可改，存数据库。
 *
 * label / hint 都是中文原文，页面上再走语言包翻译。
 */

export type ConfigGroup = "auth" | "service";

export type ConfigKey = {
  key: string;
  label: string;
  hint: string;
  /** 敏感值：不回显到前端 */
  secret: boolean;
  group: ConfigGroup;
};

export const CONFIG_KEYS: ConfigKey[] = [
  {
    key: "MONGODB_URI",
    group: "auth",
    label: "数据库连接串",
    hint: "MongoDB Atlas 的连接串。改了会立刻重连数据库，页面可能短暂打不开。",
    secret: true,
  },
  {
    key: "AUTH_SECRET",
    group: "auth",
    label: "会话密钥",
    hint: "用来签名登录状态。改了之后所有设备都要重新登录，已绑定的验证器也要重新绑定。",
    secret: true,
  },
  {
    key: "RECOVERY_TOKEN",
    group: "auth",
    label: "紧急密钥",
    hint: "两把钥匙都丢了时的救急入口。设了要记住，用完可以删掉。",
    secret: true,
  },
  {
    key: "RP_ID",
    group: "auth",
    label: "Passkey 域名主体",
    hint: "必须是正式域名的主机名，例如 slug.insapp.tech。填错会导致已绑定的 Passkey 失效。",
    secret: false,
  },
  {
    key: "ORIGIN",
    group: "auth",
    label: "站点地址",
    hint: "站点的完整地址，例如 https://slug.insapp.tech。确认邮件里的链接按它拼。",
    secret: false,
  },
  {
    key: "RESEND_API_KEY",
    group: "service",
    label: "发信 API key",
    hint: "Resend 后台创建的密钥。没配就发不出验证器变更确认信。",
    secret: true,
  },
  {
    key: "RESEND_FROM",
    group: "service",
    label: "发件人",
    hint: "形如 inslog <no-reply@你的域名>，域名要先在 Resend 验证过。",
    secret: false,
  },
  {
    key: "BLOB_READ_WRITE_TOKEN",
    group: "service",
    label: "图片存储令牌",
    hint: "Vercel Blob 的读写令牌。没有它就插不了图。",
    secret: true,
  },
];

export const AUTH_KEYS = CONFIG_KEYS.filter((item) => item.group === "auth");
export const SERVICE_KEYS = CONFIG_KEYS.filter((item) => item.group === "service");
