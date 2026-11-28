import { getEnvValue } from "./env-config";

/**
 * 站点对外地址，优先用正式域名。
 *
 * 用 getEnvValue 而不是直接读 process.env：用户在服务器 .env 里配置 ORIGIN 后，
 * 进程环境变量不会跟着变，直接读会拿到空值，canonical / RSS 的地址就退回 localhost。
 */
export function siteOrigin(): string {
  const raw =
    getEnvValue("NEXT_PUBLIC_SITE_URL") ||
    getEnvValue("ORIGIN") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
