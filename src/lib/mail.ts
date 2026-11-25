import nodemailer from "nodemailer";
import { getT } from "@/lib/i18n";
import { getServiceValue } from "./service-config";

/**
 * 发信：两种通道，按 MAIL_PROVIDER 选。
 *
 * - resend：走 Resend 的 HTTP 接口，一个 fetch 就够
 * - smtp：任何 SMTP 服务器（QQ / Gmail / 阿里云邮件推送 / 自建 Postfix）
 *
 * 没配置时 mailConfig() 返回 null，上层据此禁用「更换 / 解绑验证器」——
 * 那两个操作需要邮件确认来兜底，没有发信能力就不能开。
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type MailProvider = "resend" | "smtp";

export type MailConfig =
  | { provider: "resend"; apiKey: string; from: string }
  | {
      provider: "smtp";
      host: string;
      port: number;
      user?: string;
      password?: string;
      from: string;
      secure: boolean;
    };

export async function getMailProvider(): Promise<MailProvider> {
  const raw = (await getServiceValue("MAIL_PROVIDER"))?.trim().toLowerCase();
  return raw === "smtp" ? "smtp" : "resend";
}

export async function mailConfig(): Promise<MailConfig | null> {
  const provider = await getMailProvider();

  if (provider === "smtp") {
    const [host, port, user, password, from, secure] = await Promise.all([
      getServiceValue("SMTP_HOST"),
      getServiceValue("SMTP_PORT"),
      getServiceValue("SMTP_USER"),
      getServiceValue("SMTP_PASSWORD"),
      getServiceValue("SMTP_FROM"),
      getServiceValue("SMTP_SECURE"),
    ]);
    if (!host || !from) return null;
    const portNum = Number(port);
    return {
      provider: "smtp",
      host: host.trim(),
      port: Number.isFinite(portNum) && portNum > 0 ? portNum : 587,
      user: user?.trim() || undefined,
      password: password || undefined,
      from: from.trim(),
      // 填 1 表示端口 465 那种直连加密；587 一般走 STARTTLS
      secure:
        secure?.trim() === "1" || secure?.trim().toLowerCase() === "true",
    };
  }

  const [apiKey, from] = await Promise.all([
    getServiceValue("RESEND_API_KEY"),
    getServiceValue("RESEND_FROM"),
  ]);
  if (!apiKey || !from) return null;
  return { provider: "resend", apiKey, from };
}

export async function isMailConfigured(): Promise<boolean> {
  return (await mailConfig()) !== null;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const t = await getT();
  const cfg = await mailConfig();
  if (!cfg) throw new Error(t("还没配发信服务"));

  if (cfg.provider === "smtp") {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.password ?? "" } : undefined,
    });
    await transport.sendMail({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return;
  }

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
