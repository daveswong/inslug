"use client";

// 站点设置：四组平铺，一个保存按钮，只提交改过的字段
import { useActionState, useState, type ReactNode } from "react";
import type { SettingsDoc, SocialLink } from "@/lib/types";
import { saveSiteSettings, type SettingsState } from "./actions";
import ImageField from "./image-field";
import { useT } from "@/components/i18n-provider";

const initialState: SettingsState = { status: "idle", message: "" };

type Values = {
  siteName: string;
  description: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  postsPerPage: number;
  footerText: string;
  notifyEmail: string;
  favicon: string;
  ogImage: string;
  social: SocialLink[];
};

function toValues(settings: SettingsDoc): Values {
  return {
    siteName: settings.siteName,
    description: settings.description,
    author: settings.author,
    seoTitle: settings.seoTitle,
    seoDescription: settings.seoDescription,
    seoKeywords: settings.seoKeywords,
    postsPerPage: settings.postsPerPage,
    footerText: settings.footerText,
    notifyEmail: settings.notifyEmail ?? "",
    favicon: settings.favicon,
    ogImage: settings.ogImage,
    social: settings.social as SocialLink[],
  };
}

type Props = {
  settings: SettingsDoc;
  /** 外观组里的主题 / 界面语言控件（独立保存，不进表单） */
  appearanceExtras?: ReactNode;
  /** 安全组里的 Passkey / 验证器管理（各自的操作，不进表单） */
  securityExtras?: ReactNode;
};

export default function SettingsForm({
  settings,
  appearanceExtras,
  securityExtras,
}: Props) {
  const t = useT();
  const [state, action, pending] = useActionState(saveSiteSettings, initialState);
  const initial = toValues(settings);
  const [values, setValues] = useState<Values>(initial);

  const changed = (key: keyof Values) =>
    key === "social"
      ? JSON.stringify(values.social) !== JSON.stringify(initial.social)
      : values[key] !== initial[key];
  const dirtyKeys = (Object.keys(initial) as (keyof Values)[]).filter(changed);
  const dirty = dirtyKeys.length > 0;

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const updateLink = (index: number, key: keyof SocialLink, value: string) =>
    set(
      "social",
      values.social.map((link, i) => (i === index ? { ...link, [key]: value } : link))
    );
  const addLink = () => set("social", [...values.social, { title: "", url: "" }]);
  const removeLink = (index: number) =>
    set("social", values.social.filter((_, i) => i !== index));

  // 这些是可编辑字段的展示名；可见控件用 _ 前缀命名，避免和下面提交的隐藏字段同名
  return (
    <form action={action}>
      {dirtyKeys.map((key) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={key === "social" ? JSON.stringify(values.social) : String(values[key])}
        />
      ))}

      <section className="section">
        <h2 className="section-title">{t("站点信息")}</h2>
        <div className="site-form">
          <label className="field">
            <span className="field-label">{t("站点名")}</span>
            <input
              name="_siteName"
              value={values.siteName}
              onChange={(e) => set("siteName", e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{t("简介")}</span>
            <textarea
              name="_description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
            />
          </label>
          <label className="field">
            <span className="field-label">{t("作者")}</span>
            <input
              name="_author"
              value={values.author}
              onChange={(e) => set("author", e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">{t("标题")}</span>
            <input
              name="_seoTitle"
              value={values.seoTitle}
              onChange={(e) => set("seoTitle", e.target.value)}
              placeholder={t("留空用站点名")}
            />
          </label>
          <label className="field">
            <span className="field-label">{t("描述")}</span>
            <textarea
              name="_seoDescription"
              value={values.seoDescription}
              onChange={(e) => set("seoDescription", e.target.value)}
              rows={2}
              placeholder={t("留空用简介")}
            />
          </label>
          <label className="field">
            <span className="field-label">{t("关键词")}</span>
            <input
              name="_seoKeywords"
              value={values.seoKeywords}
              onChange={(e) => set("seoKeywords", e.target.value)}
              placeholder={t("用逗号分隔")}
            />
          </label>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t("外观")}</h2>
        <div className="site-form">
          <ImageField
            name="_favicon"
            label="favicon"
            value={values.favicon}
            ratio="square"
            onChange={(v) => set("favicon", v)}
            placeholder={t("图片地址，留空用默认")}
          />
          <ImageField
            name="_ogImage"
            label={t("分享图")}
            value={values.ogImage}
            ratio="wide"
            onChange={(v) => set("ogImage", v)}
            placeholder={t("图片地址，留空用默认渐变图标")}
          />
          <label className="field">
            <span className="field-label">{t("每页文章数")}</span>
            <input
              name="_postsPerPage"
              type="number"
              min={1}
              max={50}
              value={values.postsPerPage}
              onChange={(e) => set("postsPerPage", Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field-label">{t("页脚文字")}</span>
            <input
              name="_footerText"
              value={values.footerText}
              onChange={(e) => set("footerText", e.target.value)}
              placeholder={t("留空用默认页脚")}
            />
          </label>
        </div>
        {appearanceExtras && <div className="settings-extras">{appearanceExtras}</div>}
      </section>

      <section className="section">
        <h2 className="section-title">{t("社交链接")}</h2>
        <div className="site-form">
          {values.social.map((link, index) => (
            <div className="social-row" key={index}>
              <input
                className="search-input"
                value={link.title}
                onChange={(e) => updateLink(index, "title", e.target.value)}
                placeholder={t("标题")}
                aria-label={t("标题")}
              />
              <input
                className="search-input"
                value={link.url}
                onChange={(e) => updateLink(index, "url", e.target.value)}
                placeholder="https://..."
                aria-label="URL"
              />
              <button
                className="btn btn-outline-light btn-plain"
                type="button"
                onClick={() => removeLink(index)}
              >
                {t("删除")}
              </button>
            </div>
          ))}
          <button className="btn btn-outline-light btn-plain" type="button" onClick={addLink}>
            {t("添加")}
          </button>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t("安全")}</h2>
        <div className="site-form">
          <label className="field">
            <span className="field-label">{t("通知邮箱")}</span>
            <input
              name="_notifyEmail"
              type="email"
              value={values.notifyEmail}
              onChange={(e) => set("notifyEmail", e.target.value)}
            />
          </label>
        </div>
        {securityExtras && <div className="settings-extras">{securityExtras}</div>}
      </section>

      <div className="form-actions">
        <button
          className="btn btn-outline-light btn-plain"
          type="submit"
          disabled={pending || !dirty}
        >
          {pending ? t("保存中…") : t("保存")}
        </button>
        {state.message && (
          <span
            className={state.status === "error" ? "form-error form-msg" : "form-msg"}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
