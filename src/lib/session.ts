import { SignJWT, jwtVerify } from "jose";

// 会话与 Passkey 挑战用的 cookie 名（中间件和 Node 运行时共用这个文件，不要引 next/headers）
export const SESSION_COOKIE = "inslug_session";
export const CHALLENGE_COOKIE = "inslug_challenge";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

function secretKey(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw) throw new Error("缺少 AUTH_SECRET 环境变量");
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
 * middleware 跑在 Edge 上连不了数据库，那里只能做这层粗筛。
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
