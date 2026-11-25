"use server";

/**
 * 生成 AUTH_SECRET 与 RECOVERY_TOKEN。
 *
 * 这两个值让程序自己生成，比让人手写强：
 * - 长度足够（32 字节随机数，base64 后 44 个字符）
 * - 不会出现人为的弱口令
 * - 密码里的特殊字符不需要用户自己转义
 *
 * 自部署：直接写进 .env，刷新即生效。
 * Vercel：文件系统只读，生成后交给用户复制到项目环境变量里。
 *
 * 值只在这一次响应里返回给浏览器，不会存进数据库，也不会写进日志。
 */
import { randomBytes } from "node:crypto";
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { canWriteEnvFile, setEnvValues } from "@/lib/env-config";
import { hasCredentials } from "./config-actions";

export type SecretsResult =
  | {
      ok: true;
      /** 会话签名密钥 */
      authSecret: string;
      /** 紧急入口密钥 */
      recoveryToken: string;
      /** 是否已经写进 .env（Vercel 上为 false） */
      written: boolean;
    }
  | { ok: false; error: string };

/** 生成一把新密钥：32 字节随机数，base64 */
function newSecret(): string {
  return randomBytes(32).toString("base64");
}

export async function generateSecretsAction(): Promise<SecretsResult> {
  const t = await getT();

  // 站点还没初始化时允许免登录生成；已经初始化了就必须先登录
  const loggedIn = await isLoggedIn();
  if (!loggedIn && (await hasCredentials())) {
    return { ok: false, error: t("站点已经初始化，请先登录再修改配置") };
  }

  const authSecret = newSecret();
  const recoveryToken = newSecret();

  const writable = canWriteEnvFile();
  if (writable) {
    const result = setEnvValues({
      AUTH_SECRET: authSecret,
      RECOVERY_TOKEN: recoveryToken,
    });
    if (!result.ok) return { ok: false, error: result.error };
  }

  return { ok: true, authSecret, recoveryToken, written: writable };
}
