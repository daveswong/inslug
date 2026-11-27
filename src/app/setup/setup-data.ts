/**
 * 安装向导要用的数据。
 *
 * 站点只保留首次安装向导（/setup）：配环境变量、检查通过即完成。
 * 登录方式（邮箱、Passkey、验证器）都在首次登录后到设置页配。
 */
import { getAuth, passkeyAddAllowed } from "@/lib/credentials";
import { getSettings } from "@/lib/settings";
import { listPasskeys } from "@/lib/passkey";
import { mailReady } from "@/lib/change-request";
import { getEnvValue } from "@/lib/env-config";
import { buildServiceFeatures } from "@/lib/service-features";
import { AUTH_KEYS } from "@/lib/config-keys";
import { ensureDatabase, hasDbConfig, type DatabaseStatus } from "@/lib/mongodb";
import { getT } from "@/lib/i18n";

export async function getSetupData(): Promise<{
  settings: Awaited<ReturnType<typeof getSettings>>;
  passkeys: {
    credentialId: string;
    createdAt: string;
    lastUsedAt: string | null;
    transports: string[];
  }[];
  passkeyCount: number;
  authorized: boolean;
  hasTotp: boolean;
  mailReady: boolean;
  recoveryReady: boolean;
  rpId: string;
  origin: string;
  requestHost: string;
  rpIdMatchesHost: boolean;
  originHost: string;
  dbStatus: DatabaseStatus | null;
  /** 有没有配数据库地址（配了但连不上时，用来给出更具体的提示） */
  dbConfigured: boolean;
  serviceFeatures: Awaited<ReturnType<typeof buildServiceFeatures>>;
  manualAuthItems: {
    key: string;
    label: string;
    hint: string;
    secret: boolean;
    configured: boolean;
    generated: boolean;
    options?: { value: string; label: string }[];
    value: string;
  }[];
  generatedAuthItems: {
    key: string;
    label: string;
    hint: string;
    secret: boolean;
    configured: boolean;
    generated: boolean;
    options?: { value: string; label: string }[];
    value: string;
  }[];
}> {
  const t = await getT();

  const settings = await getSettings();
  const [keyDocs, authorized] = await Promise.all([
    listPasskeys().catch(() => []),
    passkeyAddAllowed().catch(() => false),
  ]);
  const passkeys = keyDocs.map((key) => ({
    credentialId: key.credentialId,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    transports: key.transports ?? [],
  }));

  let hasTotp = false;
  try {
    hasTotp = (await getAuth()).totpBound;
  } catch {
    hasTotp = false;
  }

  // 服务器上有没有 RECOVERY_TOKEN：紧急登录入口开不开，全看这个。
  const recoveryReady = (getEnvValue("RECOVERY_TOKEN") ?? "").length >= 16;

  // Passkey 的域名配置对不对得上当前这个站点。
  // 浏览器只说「The RP ID "x" is invalid for this domain」，不说是哪个域名不对，
  // 所以这里把服务器读到的值和当前请求的主机名都摆出来。
  const headersList = await import("next/headers");
  const h = await headersList.headers();
  const requestHost = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();
  const rpId = getEnvValue("RP_ID") ?? "";
  const origin = getEnvValue("ORIGIN") ?? "";
  const rpIdLower = rpId.trim().toLowerCase();
  const rpIdMatchesHost =
    !!requestHost &&
    !!rpIdLower &&
    (requestHost === rpIdLower || requestHost.endsWith(`.${rpIdLower}`));
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).hostname.toLowerCase() : "";
  } catch {
    originHost = "";
  }

  let dbStatus: DatabaseStatus | null = null;
  try {
    dbStatus = await ensureDatabase();
  } catch {
    dbStatus = null;
  }

  const serviceFeatures = await buildServiceFeatures(t);

  const authItems = AUTH_KEYS.map((item) => ({
    key: item.key,
    label: t(item.label),
    hint: t(item.hint),
    secret: item.secret,
    configured: Boolean(getEnvValue(item.key)),
    generated: Boolean(item.generated),
    options: item.options?.map((option) => ({
      value: option.value,
      label: t(option.label),
    })),
    value: getEnvValue(item.key) ?? "",
  }));

  return {
    settings,
    passkeys,
    passkeyCount: passkeys.length,
    authorized,
    hasTotp,
    mailReady: await mailReady().catch(() => false),
    recoveryReady,
    rpId,
    origin,
    requestHost,
    rpIdMatchesHost,
    originHost,
    dbStatus,
    dbConfigured: hasDbConfig(),
    serviceFeatures,
    // 手填的：数据库地址、库名、域名这些
    manualAuthItems: authItems.filter((item) => !item.generated),
    // 程序生成的：会话密钥、紧急密钥
    generatedAuthItems: authItems.filter((item) => item.generated),
  };
}
