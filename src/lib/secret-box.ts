import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnvValue } from "./env-config";

/**
 * 落库敏感值的对称加密（AES-256-GCM）。
 *
 * 目前只用来保护 TOTP 的 secret：数据库里存明文 secret 等于把第二因素一起送出去，
 * 拿到它就能算出任意时刻的验证码。密钥由 AUTH_SECRET 派生，所以换 AUTH_SECRET
 * 会让已存的 secret 解不开（等价于验证器失效，需要重新绑定）。
 *
 * 密钥来源必须和 session.ts 一致（都用 getEnvValue）：
 * 用户在服务器 .env 里配置 AUTH_SECRET 后，进程环境变量不会跟着变——
 * 两处取值口径不一致会导致「会话用新密钥、加密用旧密钥」，验证器直接失效。
 */

function key(): Buffer {
  const raw = getEnvValue("AUTH_SECRET");
  if (!raw) throw new Error("缺少 AUTH_SECRET 环境变量");
  // 任意长度的 AUTH_SECRET 都压成 32 字节，AES-256 要这个长度
  return createHash("sha256").update(raw).digest();
}

/** 密文格式：iv.tag.data，三段都是 base64url */
export function sealValue(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((part) => part.toString("base64url"))
    .join(".");
}

/** 解不开就返回 null：密钥换过、密文被改过，都当没有 */
export function openValue(payload: string): string | null {
  try {
    const [iv, tag, data] = payload
      .split(".")
      .map((part) => Buffer.from(part, "base64url"));
    if (!iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
