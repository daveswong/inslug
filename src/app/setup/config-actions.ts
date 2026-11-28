"use server";

/**
 * 安装引导的服务端检查。
 *
 * 安全边界：程序不写入服务器环境变量。/setup 只负责收集要写进 .env 的值，
 * 生成文件交给用户下载；用户自行保存到服务器或导入平台后台之后，
 * 这里的检查才读得到新配置。
 */
import { getAuth } from "@/lib/credentials";
import { getEnvValue } from "@/lib/env-config";
import { listPasskeys } from "@/lib/passkey";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";
import {
  hasDbConfig,
  hasDbNameConfigured,
} from "@/lib/mongodb";
import { isMailConfigured } from "@/lib/mail";

/**
 * 站点上是否已经存在任何登录凭据。
 *
 * 返回三态而不是布尔值，因为「查不到」有两种完全不同的含义：
 * - 有凭据：站点已初始化
 * - 确实没有：新部署，配置步骤可以免登录打开
 * - 查不到（数据库连不上）：**不能当成「没有」**——
 *   否则数据库一抖动，页面就会露出不该露的入口。
 *   这种情况一律按「有凭据」处理。
 */
export async function hasCredentials(): Promise<boolean> {
  // 连接串压根没配 → 全新部署，还在装站的起步阶段。
  // 这跟「配了但连不上」必须分开：首次安装时数据库本来就连不上。
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

/**
 * 第 1 步点「检查配置，完成安装」时的放行检查。
 *
 * 读服务端实时配置（getEnvValue / isMailConfigured），而不是前端输入框里的草稿——
 * 填了还没保存到服务器就放行，等于把配置检查这道关白设了。
 *
 * 图片存储不算必填；SETTINGS_STORE 有默认值也不算。
 * 库名必须明确指定（MONGODB_DB_NAME 或连接串路径）——否则会连到默认库、
 * 读到同一个集群里其它站点的数据。返回缺项的 label（中文原文），前端再翻译。
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
  // 库名：MONGODB_DB_NAME 或连接串路径，两者都没有就拦住
  if (!hasDbNameConfigured()) missing.push(t("库名"));

  // 发信通道：resend 要 apiKey+from，smtp 要 host+from，按当前 provider 判断
  if (!(await isMailConfigured().catch(() => false))) {
    missing.push(t("发信方式"));
  }

  return { ok: missing.length === 0, missing };
}
