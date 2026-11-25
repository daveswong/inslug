"use server";

// 站点设置的保存：只处理站点展示信息，不碰任何数据库连接配置
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { getPasswordHash, isLoggedIn } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/settings";
import { isMailConfigured } from "@/lib/mail";
import { requestPasswordChange } from "@/lib/change-request";

export type SettingsState = { status: "idle" | "ok" | "error"; message: string };
export type PasswordState = { status: "idle" | "ok" | "error"; message: string };

export async function saveSiteSettings(
  _prev: SettingsState,
  form: FormData
): Promise<SettingsState> {
  // 中间件已经拦过一次，这里再校验一遍（纵深防御）
  if (!(await isLoggedIn())) {
    return { status: "error", message: "登录已过期，请重新登录后再试" };
  }

  const value = (key: string) => String(form.get(key) ?? "").trim();

  const siteName = value("siteName");
  if (!siteName) return { status: "error", message: "站点名不能为空" };

  const perPage = Number(value("postsPerPage"));
  const postsPerPage = Number.isFinite(perPage)
    ? Math.min(50, Math.max(1, Math.round(perPage)))
    : 10;

  try {
    await saveSettings({
      siteName,
      description: value("description"),
      author: value("author"),
      seoTitle: value("seoTitle"),
      seoDescription: value("seoDescription"),
      seoKeywords: value("seoKeywords"),
      social: {
        github: value("github"),
        x: value("x"),
        email: value("email"),
      },
      favicon: value("favicon"),
      ogImage: value("ogImage"),
      footerText: value("footerText"),
      postsPerPage,
      notifyEmail: value("notifyEmail"),
    });
    return { status: "ok", message: "已保存" };
  } catch {
    return { status: "error", message: "保存失败：数据库连接异常" };
  }
}

/**
 * 提交修改密码：校验通过后不发立即生效，而是把新哈希存进待确认集合并发确认信。
 * 真正的写库发生在邮件里的链接点开之后（/confirm/[token]）。
 */
export async function submitPasswordChange(
  _prev: PasswordState,
  form: FormData
): Promise<PasswordState> {
  if (!(await isLoggedIn())) {
    return { status: "error", message: "登录已过期，请重新登录后再试" };
  }

  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  const repeat = String(form.get("repeatPassword") ?? "");

  if (!current) return { status: "error", message: "请先填写当前密码" };
  if (next.length < 8) return { status: "error", message: "新密码至少 8 位" };
  if (next !== repeat) return { status: "error", message: "两次输入的新密码不一致" };
  if (next === current) {
    return { status: "error", message: "新密码不能和当前密码相同" };
  }

  const notifyEmail = (await getSettings()).notifyEmail.trim();
  if (!notifyEmail) {
    return { status: "error", message: "先在「通知」里填写通知邮箱并保存" };
  }
  if (!isMailConfigured()) {
    return { status: "error", message: "服务端还没配置发信服务，暂时无法修改" };
  }

  const hash = await getPasswordHash();
  if (!hash || !(await bcrypt.compare(current, hash))) {
    return { status: "error", message: "当前密码不对" };
  }

  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin =
    process.env.ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${forwardedHost}`;
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "未知";
  const ua = h.get("user-agent") ?? "";

  try {
    const result = await requestPasswordChange({
      notifyEmail,
      passwordHash: await bcrypt.hash(next, 12),
      linkOrigin: origin,
      ip,
      ua,
    });
    if ("error" in result) return { status: "error", message: result.error };
    return {
      status: "ok",
      message: `确认信已发到 ${notifyEmail}，10 分钟内有效`,
    };
  } catch {
    return { status: "error", message: "发送失败：数据库或邮件服务异常" };
  }
}
