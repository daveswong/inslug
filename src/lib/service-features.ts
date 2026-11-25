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
    providers: { value: string; label: string }[]
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

  return [
    build("storage", t("图片存储"), "STORAGE_PROVIDER", STORAGE_PROVIDERS),
    build("mail", t("发信方式"), "MAIL_PROVIDER", MAIL_PROVIDERS),
  ];
}
