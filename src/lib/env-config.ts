import { readEnvFile } from "./env-store";

/**
 * 环境变量的只读访问。
 *
 * 这一组是「身份验证与启动必需」的配置：数据库地址、会话密钥、紧急密钥、
 * Passkey 域名、站点地址。只能由用户通过服务器配置或平台后台设置，
 * 程序不会把任何前台提交的值写进服务器环境变量。
 *
 * 读取顺序：.env 文件 > 进程环境变量。
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

/** 同步读一个环境变量 */
export function getEnvValue(key: string): string | undefined {
  const fromFile = envFileValues()[key];
  if (fromFile) return fromFile;
  const fromProcess = process.env[key];
  if (fromProcess) return fromProcess;
  return undefined;
}

/** 是否跑在 Vercel 上：那边环境变量只在项目后台配置 */
export function isVercel(): boolean {
  return Boolean(process.env.VERCEL);
}
