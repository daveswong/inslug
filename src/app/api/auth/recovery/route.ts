// 紧急入口：两把钥匙都丢了的时候，用环境变量里的一把临时密钥把门打开
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { startSession } from "@/lib/auth";
import { clientKey, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getT } from "@/lib/i18n";

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(req: Request) {
  const t = await getT();
  const expected = process.env.RECOVERY_TOKEN;
  // 没设、或者设得太短（随手写的几个字符不算密钥），就当这个入口不存在
  if (!expected || expected.length < 16) {
    return NextResponse.json({ error: t("没有配置紧急入口") }, { status: 404 });
  }

  const key = `recovery:${clientKey(req)}`;
  const gate = await rateLimit(key, 3);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: `尝试次数过多，请 ${gate.minutes} 分钟后再试` },
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
