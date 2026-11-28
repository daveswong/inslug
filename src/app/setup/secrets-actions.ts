"use server";

/**
 * 生成 AUTH_SECRET 与 RECOVERY_TOKEN。
 *
 * 这两个值让程序自己生成，比让人手写强：
 * - 长度足够（32 字节随机数，base64 后 44 个字符）
 * - 不会出现人为的弱口令
 * - 密码里的特殊字符不需要用户自己转义
 *
 * 生成后只在这一次响应里返回给浏览器，由 .env 文件带回去；
 * 程序不会写服务器上的环境变量，也不会存进数据库或日志。
 */
import { randomBytes } from "node:crypto";

export type SecretsResult = {
  ok: true;
  /** 会话签名密钥 */
  authSecret: string;
  /** 紧急入口密钥 */
  recoveryToken: string;
};

/** 生成一把新密钥：32 字节随机数，base64 */
function newSecret(): string {
  return randomBytes(32).toString("base64");
}

export async function generateSecretsAction(): Promise<SecretsResult> {
  return {
    ok: true,
    authSecret: newSecret(),
    recoveryToken: newSecret(),
  };
}

export type RecoveryTokenResult = {
  ok: true;
  recoveryToken: string;
};

/**
 * 紧急登录页单独生成一把恢复密钥。
 * 只在本次响应里返回给浏览器：不写环境变量、不写数据库、不生效，
 * 用户自行保存到 .env / Vercel 并重新部署 / 重启后才生效。
 */
export async function generateRecoveryTokenAction(): Promise<RecoveryTokenResult> {
  return { ok: true, recoveryToken: newSecret() };
}
