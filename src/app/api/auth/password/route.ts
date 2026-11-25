// 后备登录方式：密码（Passkey 丢了的时候用）
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { startSession, passwordHash } from "@/lib/auth";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// 简单限速：同一来源 10 分钟内最多 5 次。注意 serverless 下内存会随实例重置，
// 单用户场景够用，真要更严格得存库。
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

export async function POST(req: Request) {
  const key = clientKey(req);
  const now = Date.now();
  const record = attempts.get(key);
  const withinWindow = record && record.resetAt > now;

  if (withinWindow && record.count >= MAX_ATTEMPTS) {
    const minutes = Math.max(1, Math.ceil((record.resetAt - now) / 60000));
    return NextResponse.json(
      { error: `尝试次数过多，请 ${minutes} 分钟后再试` },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const hash = passwordHash();
  if (!hash) {
    return NextResponse.json(
      { error: "服务端还没配置后备密码（config/auth.json 或 ADMIN_PASSWORD_HASH）" },
      { status: 500 }
    );
  }

  const ok =
    typeof body.password === "string" &&
    body.password.length > 0 &&
    (await bcrypt.compare(body.password, hash));

  if (!ok) {
    attempts.set(key, {
      count: withinWindow ? record.count + 1 : 1,
      resetAt: withinWindow ? record.resetAt : now + WINDOW_MS,
    });
    return NextResponse.json({ error: "密码不对" }, { status: 401 });
  }

  attempts.delete(key);
  await startSession();
  return NextResponse.json({ ok: true });
}
