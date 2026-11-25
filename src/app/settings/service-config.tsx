"use client";

// 设置页里的「邮件与图片存储」配置：存在数据库，改完立刻生效，不用重新部署
import { useRouter } from "next/navigation";
import ConfigFields, { type ConfigField } from "@/components/config-fields";
import { useT } from "@/components/i18n-provider";
import { saveServiceConfig } from "@/app/setup/config-actions";

export default function ServiceConfig({
  items,
}: {
  items: ConfigField[];
}) {
  const t = useT();
  const router = useRouter();

  return (
    <div className="service-config">
      <p className="notice">
        {t("这两项存在数据库里，部署之后随时可以改，不用重新部署。")}
      </p>
      <ConfigFields
        items={items}
        onSave={async (values) => {
          const result = await saveServiceConfig(values);
          if (result.ok) router.refresh();
          return result;
        }}
        successHint={t("已保存，立刻生效。")}
      />
    </div>
  );
}
