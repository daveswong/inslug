import { createPendingChange, deletePendingChange, type ChangePurpose } from "./pending";
import { sendMail, isMailConfigured } from "./mail";
import { getT } from "./i18n";
import { getSettings } from "./settings";
import { formatDateTime } from "./time";

/**
 * 凭据变更的确认信：只写待确认记录 + 发信，这一刻凭据一个字都没改。
 * 真正写库发生在确认页的 POST（见 /confirm/[token]）。
 */

/** 邮件确认可用的前提：服务端配了发信能力，且设置里填了收件邮箱 */
export async function mailReady(): Promise<boolean> {
  if (!(await isMailConfigured())) return false;
  const settings = await getSettings();
  return settings.notifyEmail.trim().length > 0;
}

/**
 * HTML 转义。
 *
 * 邮件里有几处内容来自请求头（来源 IP、User-Agent）和站点配置，
 * 直接拼进 HTML 就等于允许注入链接、标签和追踪图片——
 * 而这封信是发到站长邮箱的，攻击者能在里面放一个仿冒的「确认」链接。
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendConfirmMail(input: {
  purpose: ChangePurpose;
  payload: Record<string, unknown>;
  actionText: string;
  consequence: string;
  linkOrigin: string;
  ip: string;
  ua: string;
}): Promise<{ ok: true } | { error: string }> {
  const t = await getT();
  const settings = await getSettings();
  const to = settings.notifyEmail.trim();
  if (!to) return { error: t("设置页还没填通知邮箱") };

  const created = await createPendingChange({
    purpose: input.purpose,
    payload: input.payload,
    ip: input.ip,
    ua: input.ua,
  });
  if ("error" in created) return created;

  const origin = input.linkOrigin.replace(/\/+$/, "");
  const url = `${origin}/confirm/${created.token}`;
  const when = formatDateTime(new Date());
  const device = input.ua.slice(0, 120) || t("未知");

  const text = [
    `有人在 inslug 请求${input.actionText}。`,
    "",
    t("确认地址（10 分钟内有效，只能用一次）："),
    url,
    "",
    `申请时间：${when}`,
    `来源 IP：${input.ip}`,
    `设备：${device}`,
    "",
    input.consequence,
    t("如果不是你本人操作，忽略这封邮件即可，凭据不会改变。"),
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#111">
  <p>有人在 inslug 请求${escapeHtml(input.actionText)}。</p>
  <p><a href="${escapeHtml(url)}" style="color:#1a4fa0">确认${escapeHtml(input.actionText)}</a></p>
  <p style="color:#888;font-size:13px">链接 10 分钟内有效，只能用一次。</p>
  <p style="color:#888;font-size:13px">${escapeHtml(input.consequence)}</p>
  <p style="color:#888;font-size:13px;border-top:1px solid #e6e6e6;padding-top:12px;margin-top:20px">
    申请时间：${escapeHtml(when)}<br>
    来源 IP：${escapeHtml(input.ip)}<br>
    设备：${escapeHtml(device)}
  </p>
  <p style="color:#888;font-size:13px">如果不是你本人操作，忽略这封邮件即可，凭据不会改变。</p>
</div>`;

  try {
    await sendMail({ to, subject: `inslug：确认${input.actionText}`, text, html });
  } catch (error) {
    // 邮件没发出去就把那条待确认记录删掉：
    // 留着的话它白占「10 分钟 3 封」的配额，用户重试会立刻被限流，
    // 而那条记录对应的链接根本没送到任何人手里。
    await deletePendingChange(created.token).catch(() => undefined);
    return {
      error: error instanceof Error ? error.message : t("确认邮件发送失败"),
    };
  }
  return { ok: true };
}

export async function requestTotpChange(input: {
  action: "set" | "disable";
  sealedSecret?: string;
  linkOrigin: string;
  ip: string;
  ua: string;
}): Promise<{ ok: true } | { error: string }> {
  const t = await getT();
  const replacing = input.action === "set";
  return sendConfirmMail({
    purpose: replacing ? "totp-set" : "totp-disable",
    payload: replacing ? { sealedSecret: input.sealedSecret } : {},
    actionText: replacing ? t("更换登录验证器") : t("解绑登录验证器"),
    consequence: replacing
      ? t("确认后旧验证器立刻失效，所有设备都需要重新登录。")
      : t("确认后账号会少一把钥匙，所有设备都需要重新登录。"),
    linkOrigin: input.linkOrigin,
    ip: input.ip,
    ua: input.ua,
  });
}

export async function requestPasskeyChange(input: {
  action: "add" | "remove";
  credentialId?: string;
  linkOrigin: string;
  ip: string;
  ua: string;
}): Promise<{ ok: true } | { error: string }> {
  const t = await getT();
  const adding = input.action === "add";
  return sendConfirmMail({
    purpose: adding ? "passkey-add" : "passkey-remove",
    payload: adding ? {} : { credentialId: input.credentialId },
    actionText: adding ? t("绑定一把新的 Passkey") : t("删除一把 Passkey"),
    consequence: adding
      ? t("确认后 10 分钟内可以回设置页完成设备绑定，过期需要重新申请。")
      : t("确认后这把 Passkey 立刻失效，所有设备都需要重新登录。"),
    linkOrigin: input.linkOrigin,
    ip: input.ip,
    ua: input.ua,
  });
}

export function requestConfigReset(input: {
  linkOrigin: string;
  ip: string;
  ua: string;
}): Promise<{ ok: true } | { error: string }> {
  return sendConfirmMail({
    purpose: "config-reset",
    payload: {},
    actionText: "重置配置",
    consequence:
      "确认后会清掉数据库地址、会话密钥、紧急密钥、Passkey 域名、站点地址、发信密钥、图片存储令牌这些配置项的值。站点设置、文章、已绑定的 Passkey 和验证器都不动。",
    linkOrigin: input.linkOrigin,
    ip: input.ip,
    ua: input.ua,
  });
}

