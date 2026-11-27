import type {
  ServiceFeature,
  ServiceField,
} from "@/components/service-config-fields";
import {
  MAIL_PROVIDERS,
  SERVICE_KEYS,
  STORAGE_PROVIDERS,
} from "./config-keys";
import { getServiceValues } from "./service-config";
import { isVercel } from "./env-config";

/**
 * 把服务类配置拼成「功能块 → 方案 → 字段」的结构。
 *
 * 服务端专用：要把当前值读出来判断哪些已配置。页面（设置页、安装向导）
 * 都用它，保证两边看到的一致。
 */
export async function buildServiceFeatures(
  t: (key: string) => string
): Promise<ServiceFeature[]> {
  const values = await getServiceValues();
  const isSet = (key: string) =>
    Boolean(values[key]?.trim() || process.env[key]?.trim());

  const build = (
    id: "storage" | "mail",
    title: string,
    choiceKey: string,
    providers: { value: string; label: string }[],
    note?: string
  ): ServiceFeature => {
    const fields: ServiceField[] = SERVICE_KEYS.filter(
      (key) => key.feature === id && !key.isProviderChoice
    ).map((key) => ({
      key: key.key,
      label: t(key.label),
      hint: t(key.hint),
      secret: key.secret,
      configured: isSet(key.key),
      provider: key.provider,
    }));

    return {
      id,
      title,
      note,
      choiceKey,
      current:
        values[choiceKey]?.trim() ||
        process.env[choiceKey]?.trim() ||
        providers[0]?.value ||
        "",
      providers: providers.map((provider) => ({
        value: provider.value,
        label: t(provider.label),
      })),
      fields,
    };
  };

  // 文件存储不是安装的必填项，两种环境的补配方式差别很大，分开说清楚：
  // Vercel 可以在后台连 Blob 自动注入；其它环境要自己改 .env，早点配省事。
  const storageNote = isVercel()
    ? t("这一步可以先跳过：Vercel 上在项目后台 Storage 里连一个 Blob store，令牌会自动注入，重新部署即可。")
    : t("非 Vercel 环境建议现在就配好：以后再补要改服务器上的 .env 并重启，比较麻烦。文章的图片和附件都要用它。");

  return [
    build("storage", t("文件存储"), "STORAGE_PROVIDER", STORAGE_PROVIDERS, storageNote),
    build("mail", t("发信方式"), "MAIL_PROVIDER", MAIL_PROVIDERS),
  ];
}
