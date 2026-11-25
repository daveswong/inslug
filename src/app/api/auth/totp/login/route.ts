// 验证码登录：用手机验证器里的 6 位码换会话
import { NextResponse } from "next/server";
import { getAuth, recordTotpStep } from "@/lib/credentials";
import { startSession } from "@/lib/auth";
import { verifyCode } from "@/lib/totp";
import { clientKey, rateLimit, resetRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const key = `totp-login:${clientKey(req)}`;
  const gate = rateLimit(key, 5);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: `尝试次数过多，请 ${gate.minutes} 分钟后再试` },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = typeof body.code === "string" ? body.code : "";

  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: "数据库暂时不可用，稍后再试" }, { status: 503 });
  }

  if (!auth.totpSecret) {
    return NextResponse.json(
      { error: "还没有绑定验证器。请用 Passkey 登录后到设置页绑定。" },
      { status: 400 }
    );
  }

  const result = verifyCode(auth.totpSecret, code, auth.totpLastStep);
  if (!result.ok) {
    return NextResponse.json({ error: "验证码不对，或已经用过" }, { status: 401 });
  }

  // 先记时间步再发会话：万一写库失败，宁可让用户重试，也不要留下可复用的码
  await recordTotpStep(result.step);
  resetRateLimit(key);
  await startSession();
  return NextResponse.json({ ok: true });
}
