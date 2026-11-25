import { cookies } from "next/headers";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
  verifySessionToken,
} from "./session";

/** 登录成功后写会话 cookie */
export async function startSession(): Promise<void> {
  const token = await signSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE,
  });
}

/** 页面/接口里判断是否已登录 */
export async function isLoggedIn(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    return await verifySessionToken(token);
  } catch {
    // 缺 AUTH_SECRET 之类的配置问题当作未登录，不要整站崩掉
    return false;
  }
}

/**
 * 后备密码的哈希：部署时读环境变量 ADMIN_PASSWORD_HASH；
 * 本地读 config/auth.json（不在 env 里写，避免 bcrypt 哈希里的 $ 被 dotenv 当成变量展开）
 */
export function passwordHash(): string | null {
  const fromEnv = process.env.ADMIN_PASSWORD_HASH;
  if (fromEnv) return fromEnv;
  try {
    const raw = readFileSync(join(process.cwd(), "config", "auth.json"), "utf8");
    const parsed = JSON.parse(raw) as { passwordHash?: string };
    return parsed.passwordHash ?? null;
  } catch {
    return null;
  }
}
