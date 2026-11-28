// 紧急入口：两把钥匙都丢了的时候，用环境变量里的一把临时密钥把门打开
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { startSession } from "@/lib/auth";
import { clientKey, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getEnvValue } from "@/lib/env-config";
import { getT } from "@/lib/i18n";

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(req: Request) {
  const t = await getT();
  const expected = getEnvValue("RECOVERY_TOKEN");
  // 没设、或者设得太短：不是错误，前端只提示去服务器 / 平台后台设置。
  if (!expected || expected.length < 16) {
    return NextResponse.json({ ok: false, code: "NOT_CONFIGURED" });
  }

  const key = `recovery:${clientKey(req)}`;
  const gate = await rateLimit(key, 3);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: t("尝试次数过多，请 {minutes} 分钟后再试", { minutes: String(gate.minutes) }) },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { key?: string };
  if (!body.key || !same(body.key.trim(), expected)) {
    return NextResponse.json({ error: t("密钥不对") }, { status: 401 });
  }

  await resetRateLimit(key);
  try {
    await startSession();
  } catch {
    return NextResponse.json({ error: t("数据库暂时不可用，稍后再试") }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}