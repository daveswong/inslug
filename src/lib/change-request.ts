import { createPendingChange } from "./pending";
import { sendMail } from "./mail";
import { formatDateTime } from "./time";

/**
 * 发起「修改密码」：只写入待确认记录并发确认信，密码此刻一个字都没变。
 * 真正写库发生在确认页的 POST（见 /confirm/[token]）。
 */
export async function requestPasswordChange(input: {
  notifyEmail: string;
  passwordHash: string;
  /** 形如 https://slug.insapp.tech，用来拼邮件里的链接 */
  linkOrigin: string;
  ip: string;
  ua: string;
}): Promise<{ ok: true } | { error: string }> {
  const created = await createPendingChange({
    purpose: "password",
    payload: { passwordHash: input.passwordHash },
    ip: input.ip,
    ua: input.ua,
  });
  if ("error" in created) return created;

  const origin = input.linkOrigin.replace(/\/+$/, "");
  const url = `${origin}/confirm/${created.token}`;
  const when = formatDateTime(new Date());
  const device = input.ua.slice(0, 120) || "未知";

  const text = [
    "有人在 inslog 请求修改登录密码。",
    "",
    "确认地址（10 分钟内有效，只能用一次）：",
    url,
    "",
    `申请时间：${when}`,
    `来源 IP：${input.ip}`,
    `设备：${device}`,
    "",
    "如果不是你本人操作，忽略这封邮件即可，密码不会改变。",
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#111">
  <p>有人在 inslog 请求修改登录密码。</p>
  <p><a href="${url}" style="color:#1a4fa0">确认修改密码</a></p>
  <p style="color:#888;font-size:13px">链接 10 分钟内有效，只能用一次。</p>
  <p style="color:#888;font-size:13px;border-top:1px solid #e6e6e6;padding-top:12px;margin-top:20px">
    申请时间：${when}<br>
    来源 IP：${input.ip}<br>
    设备：${device}
  </p>
  <p style="color:#888;font-size:13px">如果不是你本人操作，忽略这封邮件即可，密码不会改变。</p>
</div>`;

  try {
    await sendMail({
      to: input.notifyEmail,
      subject: "inslog：确认修改登录密码",
      text,
      html,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "确认邮件发送失败",
    };
  }

  return { ok: true };
}
