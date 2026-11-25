// 解绑验证器：必须过邮件确认（这一步会让账号少一把钥匙）
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { clientKey } from "@/lib/rate-limit";
import { mailReady, requestTotpChange } from "@/lib/change-request";
import { getT } from "@/lib/i18n";

export async function POST(req: Request) {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: t("请先登录") }, { status: 401 });
  }

  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: t("数据库暂时不可用，稍后再试") }, { status: 503 });
  }
  if (!auth.totpSecret) {
    return NextResponse.json({ error: t("现在没有绑定验证器") }, { status: 400 });
  }
  if (!(await mailReady())) {
    return NextResponse.json(
      { error: t("还没配好邮件确认，暂时不能解绑") },
      { status: 503 }
    );
  }

  const result = await requestTotpChange({
    action: "disable",
    linkOrigin: process.env.ORIGIN || new URL(req.url).origin,
    ip: clientKey(req),
    ua: req.headers.get("user-agent") ?? "",
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, pending: true });
}
