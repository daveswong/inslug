/**
 * 可以引导配置的变量清单。
 *
 * 分两组：
 * - auth：身份验证与启动必需（数据库、会话密钥、紧急密钥、Passkey 域名、站点地址）。
 *   只在安装 / 重置引导里设置，设置页不提供修改入口——改了等于换锁。
 * - service：邮件与图片存储的凭据。部署之后随时可改，存数据库。
 *
 * service 组里再按「功能块」分：图片存储、邮件。每个功能块有一个 provider 选择器，
 * 选了哪个 provider 就只显示它的那几个字段——不选的那套不参与，也不必填。
 *
 * label / hint 都是中文原文，页面上再走语言包翻译。
 */

export type ConfigGroup = "auth" | "service";

/** service 组里的功能块 */
export type ConfigFeature = "storage" | "mail";

export type ConfigKey = {
  key: string;
  label: string;
  hint: string;
  /** 敏感值：不回显到前端 */
  secret: boolean;
  group: ConfigGroup;
  /** 属于哪个功能块（只对 service 组有意义） */
  feature?: ConfigFeature;
  /** 该字段属于哪个 provider；provider 选择器本身没有这个值 */
  provider?: string;
  /** 标记它是 provider 的下拉选择器本身 */
  isProviderChoice?: boolean;
};

export const CONFIG_KEYS: ConfigKey[] = [
  {
    key: "MONGODB_URI",
    group: "auth",
    label: "数据库连接串",
    hint: "任何 MongoDB 都行：Atlas、自建、Railway、容器里的都行。改了会立刻重连数据库，页面可能短暂打不开。",
    secret: true,
  },
  {
    key: "MONGODB_DB_NAME",
    group: "auth",
    label: "库名",
    hint: "同一个 MongoDB 集群里可以跑多个站点，用不同的库名区分。留空用 inslug；填一个还不存在的库名，安装时会自动建出来。",
    secret: false,
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
    hint: "必须是正式域名的主机名，例如 inslug.example.com。填错会导致已绑定的 Passkey 失效。",
    secret: false,
  },
  {
    key: "ORIGIN",
    group: "auth",
    label: "站点地址",
    hint: "站点的完整地址，例如 https://inslug.example.com。确认邮件里的链接按它拼。",
    secret: false,
  },

  // ── 图片存储 ────────────────────────────────
  {
    key: "STORAGE_PROVIDER",
    group: "service",
    feature: "storage",
    isProviderChoice: true,
    label: "图片存储方式",
    hint: "选一个。Vercel 部署用 Vercel Blob 最省事；自建服务器可以用本地磁盘或任何 S3 兼容服务。",
    secret: false,
  },
  {
    key: "BLOB_READ_WRITE_TOKEN",
    group: "service",
    feature: "storage",
    provider: "vercel-blob",
    label: "图片存储令牌",
    hint: "Vercel Blob 的读写令牌。连上 Blob store 后 Vercel 会自动注入这个变量，不用手填。",
    secret: true,
  },
  {
    key: "S3_ENDPOINT",
    group: "service",
    feature: "storage",
    provider: "s3",
    label: "S3 接入地址",
    hint: "留空就是 AWS S3 本身。Cloudflare R2 填 https://<账号>.r2.cloudflarestorage.com，MinIO 填 http://<主机>:9000。",
    secret: false,
  },
  {
    key: "S3_REGION",
    group: "service",
    feature: "storage",
    provider: "s3",
    label: "区域",
    hint: "AWS 是 us-east-1 之类；R2 填 auto；MinIO 留空即可。",
    secret: false,
  },
  {
    key: "S3_BUCKET",
    group: "service",
    feature: "storage",
    provider: "s3",
    label: "存储桶名",
    hint: "图片放进哪个桶。",
    secret: false,
  },
  {
    key: "S3_ACCESS_KEY_ID",
    group: "service",
    feature: "storage",
    provider: "s3",
    label: "访问密钥 ID",
    hint: "S3 兼容服务的访问密钥。",
    secret: true,
  },
  {
    key: "S3_SECRET_ACCESS_KEY",
    group: "service",
    feature: "storage",
    provider: "s3",
    label: "访问密钥",
    hint: "S3 兼容服务的密钥。只在服务端用，不会显示在前端。",
    secret: true,
  },
  {
    key: "S3_PUBLIC_URL",
    group: "service",
    feature: "storage",
    provider: "s3",
    label: "公开访问地址",
    hint: "桶的公开访问前缀，例如 https://cdn.example.com。桶需要允许匿名读取。",
    secret: false,
  },
  {
    key: "LOCAL_UPLOAD_DIR",
    group: "service",
    feature: "storage",
    provider: "local",
    label: "本地存放目录",
    hint: "相对项目根目录，默认 uploads。服务器上要可写；多实例部署需要共享这个目录。",
    secret: false,
  },

  // ── 邮件 ────────────────────────────────────
  {
    key: "MAIL_PROVIDER",
    group: "service",
    feature: "mail",
    isProviderChoice: true,
    label: "发信方式",
    hint: "选一个。没配好就不能更换或解绑验证器（那是保护你账号的最后一层）。",
    secret: false,
  },
  {
    key: "RESEND_API_KEY",
    group: "service",
    feature: "mail",
    provider: "resend",
    label: "发信 API key",
    hint: "Resend 后台创建的密钥。没配就发不出验证器变更确认信。",
    secret: true,
  },
  {
    key: "RESEND_FROM",
    group: "service",
    feature: "mail",
    provider: "resend",
    label: "发件人",
    hint: "形如 inslug <no-reply@你的域名>，域名要先在 Resend 验证过。",
    secret: false,
  },
  {
    key: "SMTP_HOST",
    group: "service",
    feature: "mail",
    provider: "smtp",
    label: "SMTP 服务器",
    hint: "QQ 邮箱是 smtp.qq.com，Gmail 是 smtp.gmail.com，自建 Postfix 填自己的主机名。",
    secret: false,
  },
  {
    key: "SMTP_PORT",
    group: "service",
    feature: "mail",
    provider: "smtp",
    label: "SMTP 端口",
    hint: "一般是 465（隐式 TLS）或 587（STARTTLS）。",
    secret: false,
  },
  {
    key: "SMTP_USER",
    group: "service",
    feature: "mail",
    provider: "smtp",
    label: "SMTP 账号",
    hint: "登录用的账号。QQ / Gmail 一般就是邮箱地址；本地 relay 不需要登录就留空。",
    secret: false,
  },
  {
    key: "SMTP_PASSWORD",
    group: "service",
    feature: "mail",
    provider: "smtp",
    label: "SMTP 密码或授权码",
    hint: "QQ / Gmail 要用「授权码」而不是登录密码。只在服务端用。",
    secret: true,
  },
  {
    key: "SMTP_FROM",
    group: "service",
    feature: "mail",
    provider: "smtp",
    label: "发件人",
    hint: "形如 inslug <no-reply@你的域名>。",
    secret: false,
  },
  {
    key: "SMTP_SECURE",
    group: "service",
    feature: "mail",
    provider: "smtp",
    label: "用隐式 TLS",
    hint: "填 1 表示端口 465 那种直连加密。587 一般留空。",
    secret: false,
  },
];

export const AUTH_KEYS = CONFIG_KEYS.filter((item) => item.group === "auth");
export const SERVICE_KEYS = CONFIG_KEYS.filter((item) => item.group === "service");

/** 图片存储的可选方案 */
export const STORAGE_PROVIDERS = [
  { value: "vercel-blob", label: "Vercel Blob（Vercel 部署最省事）" },
  { value: "s3", label: "S3 兼容（R2 / MinIO / S3 / OSS…）" },
  { value: "local", label: "本地磁盘（自建服务器）" },
];

/** 发信的可选方案 */
export const MAIL_PROVIDERS = [
  { value: "resend", label: "Resend（HTTP API）" },
  { value: "smtp", label: "SMTP（QQ / Gmail / 自建）" },
];
