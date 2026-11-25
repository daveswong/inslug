"use server";

/**
 * 安装 / 重置引导里的配置保存。
 *
 * 两组分开处理：
 * - auth（身份验证与启动必需）：只在安装 / 重置引导里设置。
 *   非 Vercel 部署写进项目根目录的 .env 文件（这个文件不进 Git，部署时生成）；
 *   Vercel 上文件系统只读写不了，改为给出清单，由站长自己去控制台填。
 * - service（邮件、图片存储）：存数据库，部署后随时能在设置页改。
 *
 * 权限规则：
 * - 站点上还没有任何登录凭据时，auth 组允许免登录写入，否则陌生人打开
 *   /setup 就能改掉你的数据库地址或会话密钥。
 * - 免登录状态下只写「当前还没配置」的项，已配置的不给覆盖。
 */
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { getEnvValue, isVercel, setEnvValues } from "@/lib/env-config";
import { setServiceValues } from "@/lib/service-config";
import { listPasskeys } from "@/lib/passkey";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";

export type ConfigSaveResult =
  | { ok: true; written: string[] }
  | { ok: false; error: string };

/** 站点上是否已经存在任何登录凭据 */
export async function hasCredentials(): Promise<boolean> {
  try {
    const [keys, auth, settings] = await Promise.all([
      listPasskeys(),
      getAuth(),
      getSettings(),
    ]);
    if (keys.length > 0) return true;
    if (auth.totpSecret) return true;
    return settings.setupCompleted;
  } catch {
    // 数据库连不上：本来就没有任何凭据
    return false;
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
  return { ok: true, written };
}

/** 邮件与图片存储的变量：存数据库，部署后随时可改 */
export async function saveServiceConfig(
  values: Record<string, string>
): Promise<ConfigSaveResult> {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return { ok: false, error: t("登录已过期，请重新登录") };
  }

  const updates: Record<string, string | null> = {};
  const written: string[] = [];
  for (const [key, raw] of Object.entries(values)) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    updates[key] = value;
    written.push(key);
  }
  if (!written.length) {
    return { ok: false, error: t("没有需要保存的内容") };
  }

  const result = await setServiceValues(updates);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, written };
}
