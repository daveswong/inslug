/**
 * 发信：直接用 Resend 的 HTTP 接口，一个 fetch 就够，不引 SMTP 库。
 *
 * 需要两个环境变量：
 * - RESEND_API_KEY：Resend 后台创建的 API key
 * - RESEND_FROM：发件人，形如 `inslog <no-reply@insapp.tech>`
 *   域名必须先在 Resend 里验证过（加 SPF/DKIM 记录），否则只能发给自己账号的邮箱。
 *
 * 没配置时 mailConfig() 返回 null，上层据此禁用「更换 / 解绑验证器」。
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function mailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function isMailConfigured(): boolean {
  return mailConfig() !== null;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const cfg = mailConfig();
  if (!cfg) throw new Error("未配置发信服务（RESEND_API_KEY / RESEND_FROM）");

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend 返回 ${res.status}：${detail.slice(0, 200)}`);
  }
}
