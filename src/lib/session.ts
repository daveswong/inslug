import { SignJWT, jwtVerify } from "jose";

// 会话与 Passkey 挑战用的 cookie 名（中间件和 Node 运行时共用这个文件，不要引 next/headers）
export const SESSION_COOKIE = "inslog_session";
export const CHALLENGE_COOKIE = "inslog_challenge";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

function secretKey(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw) throw new Error("缺少 AUTH_SECRET 环境变量");
  return new TextEncoder().encode(raw);
}

export async function signSessionToken(): Promise<string> {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

/** cookie 的公共属性：httpOnly + 同站，生产环境强制 https */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
