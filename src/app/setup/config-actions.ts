"use server";

/**
 * 安装 / 重置引导里的配置保存。
 *
 * 现在所有配置都写进同一个地方：项目根目录的 .env 文件（不进 Git，部署时生成）。
 * 非 Vercel 部署直接写文件；Vercel 上文件系统只读，改为给出清单，由站长自己去控制台填。
 *
 * 分组只是为了界面上分块展示，落地方式一样：
 * - auth（身份验证与启动必需）：只在安装 / 重置引导里设置。
 * - service（邮件、图片存储）：同样只在安装 / 重置引导里设置。
 *
 * 权限规则：
 * - 站点上还没有任何登录凭据时，auth 组允许免登录写入，否则陌生人打开
 *   /setup 就能改掉你的数据库地址或会话密钥。
 * - 免登录状态下只写「当前还没配置」的项，已配置的不给覆盖。
 */
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { getEnvValue, isVercel, setEnvValues } from "@/lib/env-config";
import { listPasskeys } from "@/lib/passkey";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";
import { ensureDatabase, hasDbConfig, type DatabaseStatus } from "@/lib/mongodb";
import { isMailConfigured } from "@/lib/mail";

export type ConfigSaveResult =
  | { ok: true; written: string[]; db?: DatabaseStatus }
  | { ok: false; error: string };

/**
 * 站点上是否已经存在任何登录凭据。
 *
 * 返回三态而不是布尔值，因为「查不到」有两种完全不同的含义：
 * - 有凭据：站点已初始化，必须登录才能改配置
 * - 确实没有：新部署，允许免登录设置（这是唯一的后门）
 * - 查不到（数据库连不上）：**不能当成「没有」**——
 *   否则数据库一抖动，任意访客就能改掉会话密钥和紧急密钥，直接接管站点。
 *   这种情况一律按「有凭据」处理，即要求登录。
 */
export async function hasCredentials(): Promise<boolean> {
  // 连接串压根没配 → 全新部署，还在装站的起步阶段，允许免登录设置。
  //
  // 这跟「配了但连不上」必须分开：首次安装时数据库本来就连不上
  // （MONGODB_URI 还没填进环境变量），如果一律按「有凭据」处理，
  // 就会被要求登录——可这时还没有任何凭据，根本登录不了，死锁。
  //
  // 安全上站得住：要让这里返回 false，得先把 MONGODB_URI 从环境变量里抹掉，
  // 那需要平台控制台的权限；有那权限的人本来就能改任何配置。
  // 而且没有数据库时站点没有任何数据，改会话密钥也换不来东西。
  if (!hasDbConfig()) return false;

  try {
    const [keys, auth, settings] = await Promise.all([
      listPasskeys(),
      getAuth(),
      getSettings(),
    ]);
    if (keys.length > 0) return true;
    // 用 totpBound 而不是 totpSecret：密钥换过导致解不开时，
    // 数据库里的密文还在，那依然是「已绑定」，不能当成没绑过。
    if (auth.totpBound) return true;
    return settings.setupCompleted;
  } catch {
    // 查不到不等于没有：按「有凭据」处理，宁可拦住也不放行
    return true;
  }
}

/** 身份验证与启动必需的变量：写 .env（仅非 Vercel） */
export async function saveAuthConfig(
  values: Record<string, string>
): Promise<ConfigSaveResult> {
  const t = await getT();
  const loggedIn = await isLoggedIn();

  if (!loggedIn && (await hasCredentials())) {
    return { ok: false, error: t("站点已经初始化，请先登录再修改配置") };
  }

  if (isVercel()) {
    return {
      ok: false,
      error: t(
        "Vercel 的文件系统是只读的，配置要填到项目的环境变量里。下面这份清单就是需要填的内容。"
      ),
    };
  }

  const updates: Record<string, string | null> = {};
  const written: string[] = [];

  for (const [key, raw] of Object.entries(values)) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    // 免登录状态下不覆盖已有配置
    if (!loggedIn && getEnvValue(key)) continue;
    updates[key] = value;
    written.push(key);
  }

  if (!written.length) {
    return { ok: false, error: t("没有需要保存的内容") };
  }

  const result = setEnvValues(updates);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // 地址写好了就去看一眼这个库：已经存在就接着用，不存在就建一个出来
  let db: DatabaseStatus | undefined;
  try {
    db = await ensureDatabase();
  } catch {
    // 连不上不算保存失败——地址已经写进去了，部署时会再连一次
  }
  return { ok: true, written, db };
}

/**
 * 第 1 步点「下一步」时的放行检查。
 *
 * 读服务端实时配置（getEnvValue / isMailConfigured），而不是前端输入框里的草稿——
 * 填了没保存就放行，等于把「先配好发信再确认邮箱」这道关白设了。
 *
 * 图片存储不算必填；库名、SETTINGS_STORE 有默认值也不算。
 * 返回缺项的 label（中文原文），前端再过语言包翻译。
 */
export async function checkSetupReady(): Promise<{
  ok: boolean;
  missing: string[];
}> {
  const t = await getT();
  const missing: string[] = [];

  // 必填的纯环境变量：数据库串、RP_ID、ORIGIN、两把密钥
  const required = [
    { key: "MONGODB_URI", label: "数据库连接串" },
    { key: "RP_ID", label: "Passkey 域名主体" },
    { key: "ORIGIN", label: "站点地址" },
    { key: "AUTH_SECRET", label: "会话密钥" },
    { key: "RECOVERY_TOKEN", label: "紧急密钥" },
  ];
  for (const { key, label } of required) {
    if (!(getEnvValue(key) ?? "").trim()) missing.push(t(label));
  }

  // 发信通道：resend 要 apiKey+from，smtp 要 host+from，按当前 provider 判断
  if (!(await isMailConfigured().catch(() => false))) {
    missing.push(t("发信方式"));
  }

  return { ok: missing.length === 0, missing };
}
