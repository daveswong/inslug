"use client";

// 站点信息表单：站点展示内容 + SEO + 社交 + 分页大小
import { useActionState } from "react";
import type { SettingsDoc } from "@/lib/types";
import { saveSiteSettings, type SettingsState } from "./actions";
import { useT } from "@/components/i18n-provider";

const initialState: SettingsState = { status: "idle", message: "" };

export default function SiteForm({ settings }: { settings: SettingsDoc }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveSiteSettings, initialState);

  return (
    <form className="site-form" action={action}>
      <h3 className="form-group">{t("基本信息")}</h3>
      <label className="field">
        <span className="field-label">{t("站点名")}</span>
        <input name="siteName" defaultValue={settings.siteName} required />
      </label>
      <label className="field">
        <span className="field-label">{t("简介")}</span>
        <textarea
          name="description"
          defaultValue={settings.description}
          rows={2}
          placeholder={t("显示在站点名下方，一句话说明这里写什么")}
        />
      </label>
      <label className="field">
        <span className="field-label">{t("作者")}</span>
        <input name="author" defaultValue={settings.author} />
      </label>
      <label className="field">
        <span className="field-label">favicon</span>
        <input
          name="favicon"
          defaultValue={settings.favicon}
          placeholder={t("图片地址，留空用默认")}
        />
      </label>
      <label className="field">
        <span className="field-label">{t("分享图")}</span>
        <input
          name="ogImage"
          defaultValue={settings.ogImage}
          placeholder={t("链接分享时显示的图，留空不显示")}
        />
      </label>

      <h3 className="form-group">{t("列表与页脚")}</h3>
      <label className="field">
        <span className="field-label">{t("每页文章数")}</span>
        <input
          name="postsPerPage"
          type="number"
          min={1}
          max={50}
          defaultValue={settings.postsPerPage}
        />
      </label>
      <label className="field">
        <span className="field-label">{t("页脚文字")}</span>
        <input
          name="footerText"
          defaultValue={settings.footerText}
          placeholder={t("留空用默认页脚")}
        />
      </label>

      <h3 className="form-group">SEO</h3>
      <label className="field">
        <span className="field-label">{t("标题")}</span>
        <input
          name="seoTitle"
          defaultValue={settings.seoTitle}
          placeholder={t("留空用站点名")}
        />
      </label>
      <label className="field">
        <span className="field-label">{t("描述")}</span>
        <textarea
          name="seoDescription"
          defaultValue={settings.seoDescription}
          rows={2}
          placeholder={t("留空用简介")}
        />
      </label>
      <label className="field">
        <span className="field-label">{t("关键词")}</span>
        <input
          name="seoKeywords"
          defaultValue={settings.seoKeywords}
          placeholder={t("用逗号分隔")}
        />
      </label>

      <h3 className="form-group">{t("通知")}</h3>
      <label className="field">
        <span className="field-label">{t("通知邮箱")}</span>
        <input
          name="notifyEmail"
          type="email"
          defaultValue={settings.notifyEmail ?? ""}
          placeholder={t("更换验证器的确认信发到这里")}
        />
      </label>

      <h3 className="form-group">{t("社交链接")}</h3>
      <label className="field">
        <span className="field-label">GitHub</span>
        <input name="github" defaultValue={settings.social.github ?? ""} placeholder={t("https://github.com/用户名")} />
      </label>
      <label className="field">
        <span className="field-label">X</span>
        <input name="x" defaultValue={settings.social.x ?? ""} placeholder={t("https://x.com/用户名")} />
      </label>
      <label className="field">
        <span className="field-label">{t("邮箱")}</span>
        <input name="email" type="email" defaultValue={settings.social.email ?? ""} placeholder="me@example.com" />
      </label>

      <div className="form-actions">
        <button className="btn btn-outline-light btn-plain" type="submit" disabled={pending}>
          {pending ? t("保存中…") : t("保存")}
        </button>
        {state.message && (
          <span className={state.status === "error" ? "form-error form-msg" : "form-msg"}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
