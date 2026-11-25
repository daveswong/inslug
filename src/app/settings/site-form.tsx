"use client";

// 站点信息表单：按折叠面板的分组拆成若干独立表单，
// 每一组有自己的保存按钮，互不影响。
import { useActionState, type ReactNode } from "react";
import type { SettingsDoc } from "@/lib/types";
import { saveSiteSettings, type SettingsState } from "./actions";
import ImageField from "./image-field";
import { useT } from "@/components/i18n-provider";

const initialState: SettingsState = { status: "idle", message: "" };

/** 每组表单底部的保存按钮与结果提示 */
function SaveBar({
  state,
  pending,
}: {
  state: SettingsState;
  pending: boolean;
}) {
  const t = useT();
  return (
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
  );
}

/** 表单外壳：带分组标记，提交时告诉服务端只更新这一组 */
function GroupForm({
  group,
  children,
}: {
  group: string;
  children: ReactNode;
}) {
  const [state, action, pending] = useActionState(saveSiteSettings, initialState);
  return (
    <form className="site-form" action={action}>
      <input type="hidden" name="__group" value={group} />
      {children}
      <SaveBar state={state} pending={pending} />
    </form>
  );
}

export function BasicForm({ settings }: { settings: SettingsDoc }) {
  const t = useT();
  return (
    <GroupForm group="basic">
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
      <ImageField
        name="favicon"
        label="favicon"
        value={settings.favicon}
        ratio="square"
        placeholder={t("图片地址，留空用默认")}
        hint={t("Safari 不认 SVG 图标，用 PNG 或 ICO 更稳")}
      />
      <ImageField
        name="ogImage"
        label={t("分享图")}
        value={settings.ogImage}
        ratio="wide"
        placeholder={t("图片地址，留空用默认渐变图标")}
        hint={t("链接分享时显示的图，推荐 1200 × 630")}
      />
    </GroupForm>
  );
}

export function ListForm({ settings }: { settings: SettingsDoc }) {
  const t = useT();
  return (
    <GroupForm group="list">
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
    </GroupForm>
  );
}

export function SeoForm({ settings }: { settings: SettingsDoc }) {
  const t = useT();
  return (
    <GroupForm group="seo">
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
    </GroupForm>
  );
}

export function NotifyForm({ settings }: { settings: SettingsDoc }) {
  const t = useT();
  return (
    <GroupForm group="notify">
      <label className="field">
        <span className="field-label">{t("通知邮箱")}</span>
        <input
          name="notifyEmail"
          type="email"
          defaultValue={settings.notifyEmail ?? ""}
          placeholder={t("更换验证器的确认信发到这里")}
        />
      </label>
    </GroupForm>
  );
}

export function SocialForm({ settings }: { settings: SettingsDoc }) {
  const t = useT();
  return (
    <GroupForm group="social">
      <label className="field">
        <span className="field-label">GitHub</span>
        <input
          name="github"
          defaultValue={settings.social.github ?? ""}
          placeholder={t("https://github.com/用户名")}
        />
      </label>
      <label className="field">
        <span className="field-label">X</span>
        <input
          name="x"
          defaultValue={settings.social.x ?? ""}
          placeholder={t("https://x.com/用户名")}
        />
      </label>
      <label className="field">
        <span className="field-label">{t("邮箱")}</span>
        <input
          name="email"
          type="email"
          defaultValue={settings.social.email ?? ""}
          placeholder="me@example.com"
        />
      </label>
    </GroupForm>
  );
}
