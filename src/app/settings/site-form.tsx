"use client";

// 站点设置：四组平铺，一个保存按钮，只提交改过的字段
import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { SettingsDoc, SocialLink } from "@/lib/types";
import { saveSiteSettings, type SettingsState } from "./actions";
import ImageField from "./image-field";
import type { ClientStorageProvider } from "@/lib/upload-client";
import { useT } from "@/components/i18n-provider";

const initialState: SettingsState = { status: "idle", message: "" };

/**
 * 社交链接在表单里的样子。
 *
 * 多一个 id 只为渲染用，不进数据库——存的是 title / url 两个字段。
 * 用它做 React 的 key，删掉中间一条时节点不会错位、焦点不会跳到别的链接上。
 */
type SocialRow = SocialLink & { id: string };

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
  social: SocialRow[];
};

let socialSeq = 0;
const nextSocialId = () => `social-${++socialSeq}`;

/**
 * 把设置转成表单的值。
 *
 * prev 用来沿用已有的 id：位置和内容都对得上就复用，
 * 否则每次渲染都换新 key，输入框会失焦。
 */
function toValues(settings: SettingsDoc, prev?: Values): Values {
  const social: SocialRow[] = settings.social.map((link, index) => {
    const old = prev?.social[index];
    if (old && old.title === link.title && old.url === link.url) return old;
    return { ...link, id: nextSocialId() };
  });
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
    social,
  };
}

type Props = {
  settings: SettingsDoc;
  /** 外观组里的主题 / 界面语言控件（独立保存，不进表单） */
  appearanceExtras?: ReactNode;
  /** 安全组里的 Passkey / 验证器管理（各自的操作，不进表单） */
  securityExtras?: ReactNode;
  /** 当前图片存储方案，决定上传走哪条路 */
  storageProvider: ClientStorageProvider;
};

export default function SettingsForm({
  settings,
  appearanceExtras,
  securityExtras,
  storageProvider,
}: Props) {
const t = useT();
const [state, action, pending] = useActionState(saveSiteSettings, initialState);
  const initial = toValues(settings);
const [values, setValues] = useState<Values>(initial);

  // 保存成功后服务端会把新的 settings 传回来（router.refresh）。
  // 不同步的话 values 还是旧值，表单会一直显示「有未保存的改动」，
  // 保存按钮也一直亮着，用户能反复点。
  useEffect(() => {
    setValues((prev) => toValues(settings, prev));
  }, [settings]);

  const changed = (key: keyof Values) =>
    key === "social"
      ? JSON.stringify(values.social.map(({ title, url }) => ({ title, url }))) !==
        JSON.stringify(initial.social.map(({ title, url }) => ({ title, url })))
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
  const addLink = () =>
    set("social", [
      ...values.social,
      { id: nextSocialId(), title: "", url: "" },
    ]);
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
          value={
            key === "social"
              ? JSON.stringify(
                  values.social.map(({ title, url }) => ({ title, url }))
                )
              : String(values[key])
          }
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
            label={t("网站图标")}
            value={values.favicon}
            provider={storageProvider}
            ratio="square"
            onChange={(v) => set("favicon", v)}
            placeholder={t("图片地址，留空用默认")}
          />
          <ImageField
            name="_ogImage"
            label={t("分享图")}
            value={values.ogImage}
            provider={storageProvider}
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
            // key 用稳定的 id，不用下标：
            // 下标作 key 时，删掉中间一条，React 会复用错误的 DOM 节点，
            // 焦点会跳到不相干的那一条链接上。
            <div className="social-row" key={link.id}>
              <input
                className="search-input"
                value={link.title}
                onChange={(e) => updateLink(index, "title", e.target.value)}
                placeholder={t("标题")}
                aria-label={t("第 {n} 条社交链接的标题", { n: index + 1 })}
              />
              <input
                className="search-input"
                value={link.url}
                onChange={(e) => updateLink(index, "url", e.target.value)}
                placeholder="https://..."
                aria-label={t("第 {n} 条社交链接的地址", { n: index + 1 })}
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
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
