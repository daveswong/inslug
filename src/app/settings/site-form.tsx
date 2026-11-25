"use client";

// 站点信息表单：站点展示内容 + SEO + 社交 + 分页大小
import { useActionState } from "react";
import type { SettingsDoc } from "@/lib/types";
import { saveSiteSettings, type SettingsState } from "./actions";

const initialState: SettingsState = { status: "idle", message: "" };

export default function SiteForm({ settings }: { settings: SettingsDoc }) {
  const [state, action, pending] = useActionState(saveSiteSettings, initialState);

  return (
    <form className="site-form" action={action}>
      <h3 className="form-group">基本信息</h3>
      <label className="field">
        <span className="field-label">站点名</span>
        <input name="siteName" defaultValue={settings.siteName} required />
      </label>
      <label className="field">
        <span className="field-label">简介</span>
        <textarea
          name="description"
          defaultValue={settings.description}
          rows={2}
          placeholder="显示在站点名下方，一句话说明这里写什么"
        />
      </label>
      <label className="field">
        <span className="field-label">作者</span>
        <input name="author" defaultValue={settings.author} />
      </label>
      <label className="field">
        <span className="field-label">favicon</span>
        <input
          name="favicon"
          defaultValue={settings.favicon}
          placeholder="图片地址，留空用默认"
        />
      </label>
      <label className="field">
        <span className="field-label">分享图</span>
        <input
          name="ogImage"
          defaultValue={settings.ogImage}
          placeholder="链接分享时显示的图，留空不显示"
        />
      </label>

      <h3 className="form-group">列表与页脚</h3>
      <label className="field">
        <span className="field-label">每页文章数</span>
        <input
          name="postsPerPage"
          type="number"
          min={1}
          max={50}
          defaultValue={settings.postsPerPage}
        />
      </label>
      <label className="field">
        <span className="field-label">页脚文字</span>
        <input
          name="footerText"
          defaultValue={settings.footerText}
          placeholder="留空用默认页脚"
        />
      </label>

      <h3 className="form-group">SEO</h3>
      <label className="field">
        <span className="field-label">标题</span>
        <input
          name="seoTitle"
          defaultValue={settings.seoTitle}
          placeholder="留空用站点名"
        />
      </label>
      <label className="field">
        <span className="field-label">描述</span>
        <textarea
          name="seoDescription"
          defaultValue={settings.seoDescription}
          rows={2}
          placeholder="留空用简介"
        />
      </label>
      <label className="field">
        <span className="field-label">关键词</span>
        <input
          name="seoKeywords"
          defaultValue={settings.seoKeywords}
          placeholder="用逗号分隔"
        />
      </label>

      <h3 className="form-group">通知</h3>
      <label className="field">
        <span className="field-label">通知邮箱</span>
        <input
          name="notifyEmail"
          type="email"
          defaultValue={settings.notifyEmail ?? ""}
          placeholder="改密码的确认信发到这里"
        />
      </label>

      <h3 className="form-group">社交链接</h3>
      <label className="field">
        <span className="field-label">GitHub</span>
        <input name="github" defaultValue={settings.social.github ?? ""} placeholder="https://github.com/用户名" />
      </label>
      <label className="field">
        <span className="field-label">X</span>
        <input name="x" defaultValue={settings.social.x ?? ""} placeholder="https://x.com/用户名" />
      </label>
      <label className="field">
        <span className="field-label">邮箱</span>
        <input name="email" type="email" defaultValue={settings.social.email ?? ""} placeholder="me@example.com" />
      </label>

      <div className="form-actions">
        <button className="btn btn-outline-light btn-plain" type="submit" disabled={pending}>
          {pending ? "保存中…" : "保存"}
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
