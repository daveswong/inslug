import { SignJWT, jwtVerify } from "jose";
import { getEnvValue } from "./env-config";

// 会话与 Passkey 挑战用的 cookie 名。常量放在 session-constants.ts，
// Edge 中间件也能引用，而不必把读 .env 的 node:fs 拖进 Edge 运行时。
import {
  CHALLENGE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "./session-constants";
export { CHALLENGE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE };

function secretKey(): Uint8Array {
  const raw = getEnvValue("AUTH_SECRET");
  if (!raw) throw new Error("缺少 AUTH_SECRET 配置");
  return new TextEncoder().encode(raw);
}

export async function signSessionToken(
  sessionVersion: number
): Promise<string> {
  return new SignJWT({ role: "owner", sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/**
 * 只验签名与过期，返回 token 里的会话版本号。
 * 版本号是否仍然等于库里的值，由 Node 侧的 isLoggedIn() 判断——
 * proxy.ts 里只做「有没有 cookie」的粗筛，这里才是真正的验签入口。
 */
export async function verifySessionToken(
  token: string
): Promise<{ sv: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return { sv: typeof payload.sv === "number" ? payload.sv : 0 };
  } catch {
    return null;
  }
}

/** cookie 的公共属性：httpOnly + 同站，生产环境强制 https */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
