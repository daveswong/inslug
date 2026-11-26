import { getEnvValue } from "./env-config";
import { SERVICE_KEYS } from "./config-keys";

/**
 * 服务类配置：图片存储与发信。
 *
 * 只存在 .env（Vercel 上是环境变量）里，不再写数据库。这样改乱了也能在服务端
 * 直接查到、改回来，不会因为网页里的一次误操作让发信和插图同时失效。
 * 非 Vercel 改 .env 约 3 秒生效；Vercel 要改环境变量并重新部署。
 */

export async function getServiceValues(): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const item of SERVICE_KEYS) {
    const value = getEnvValue(item.key);
    if (value) values[item.key] = value;
  }
  return values;
}

export async function getServiceValue(
  key: string
): Promise<string | undefined> {
  return getEnvValue(key);
}
