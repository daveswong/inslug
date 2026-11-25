import { cache } from "react";
import { cookies } from "next/headers";
import {
  COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
  verifySessionToken,
} from "./session";
import { getAuth } from "./credentials";

/** 登录成功后写会话 cookie（带上当前会话版本号） */
export async function startSession(): Promise<void> {
  const auth = await getAuth();
  const token = await signSessionToken(auth.sessionVersion);
  (await cookies()).set(SESSION_COOKIE, token, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * 当前后备密码的哈希。优先级见 credentials.ts：
 * 数据库 > ADMIN_PASSWORD_HASH > config/auth.json
 */
export async function getPasswordHash(): Promise<string | null> {
  return (await getAuth()).passwordHash;
}

/**
 * 页面/接口里判断是否已登录。
 *
 * 除了验签，还要比对 token 里的 sv 与库里的 sessionVersion：
 * 改密码后版本号 +1，别处留着的旧 cookie 立刻失效，不用等 30 天过期。
 * 用 cache 包一层，同一次渲染里首页 / layout / 页脚都调用也只查一次库。
 */
export const isLoggedIn = cache(async (): Promise<boolean> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const payload = await verifySessionToken(token);
  if (!payload) return false;
  try {
    const auth = await getAuth();
    return payload.sv === auth.sessionVersion;
  } catch {
    // 读不到版本号就无法确认会话仍然有效，按未登录处理
    return false;
  }
});
