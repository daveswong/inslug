import {
  canWriteEnvFile as probeEnvWritable,
  readEnvFile,
  writeEnvValues,
} from "./env-store";

/**
 * 环境变量组的配置：只管 .env 文件与进程环境变量，同步读取。
 *
 * 这一组是「身份验证与启动必需」的配置：数据库地址、会话密钥、紧急密钥、
 * Passkey 域名、站点地址。它们只在安装 / 重置引导里设置，平时不提供修改入口。
 *
 * 读取顺序：.env 文件 > 进程环境变量。
 * .env 优先是因为引导程序把值写进文件后，进程环境变量不会变（那是启动时注入的）。
 *
 * 这里刻意不引数据库：数据库连接本身要用到这一组的值，反过来会形成循环依赖。
 * 服务类配置（邮件、Blob）在 service-config.ts 里，那边才有数据库依赖。
 */

const CACHE_TTL_MS = 3000;

let cache: { values: Record<string, string>; at: number } | null = null;

function envFileValues(): Record<string, string> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.values;
  const values = readEnvFile();
  cache = { values, at: now };
  return values;
}

export function invalidateEnvCache(): void {
  cache = null;
}

/** 同步读一个环境变量组的配置 */
export function getEnvValue(key: string): string | undefined {
  const fromFile = envFileValues()[key];
  if (fromFile) return fromFile;
  const fromProcess = process.env[key];
  if (fromProcess) return fromProcess;
  return undefined;
}

/** 写环境变量组的配置（null 表示删除该键） */
export function setEnvValues(
  updates: Record<string, string | null>
): { ok: true } | { ok: false; error: string } {
  const result = writeEnvValues(updates);
  if (result.ok) invalidateEnvCache();
  return result;
}

/**
 * 清掉这些键。
 *
 * 这是普通函数，不是 server action：客户端调不到它。
 * 真正调用它的只有确认页的服务端动作——那一步的凭据是邮件里的一次性链接。
 */
export function resetEnvKeys(keys: string[]): { ok: true } | { ok: false; error: string } {
  const updates: Record<string, string | null> = {};
  for (const key of keys) updates[key] = null;
  const result = setEnvValues(updates);
  if (result.ok) invalidateEnvCache();
  return result;
}

/** 是否跑在 Vercel 上：那种平台文件系统只读，写不了 .env */
export function isVercel(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * 当前平台能不能写 .env 文件。
 * Vercel 上一律 false——那里的文件系统是只读的。
 */
export function canWriteEnvFile(): boolean {
  if (isVercel()) return false;
  return probeEnvWritable();
}
