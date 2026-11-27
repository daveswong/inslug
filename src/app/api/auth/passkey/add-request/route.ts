// 申请绑定新 Passkey：不立刻给挑战，先发确认邮件
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { passkeyAddAllowed } from "@/lib/credentials";
import { clientKey } from "@/lib/rate-limit";
import { mailReady, requestPasskeyChange } from "@/lib/change-request";
import { getT } from "@/lib/i18n";
import { getEnvValue } from "@/lib/env-config";

export async function POST(req: Request) {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: t("请先登录") }, { status: 401 });
  }
  if (await passkeyAddAllowed()) {
    return NextResponse.json({ ok: true, alreadyAuthorized: true });
  }
  if (!(await mailReady())) {
    return NextResponse.json(
      { error: t("还没配好邮件确认，暂时不能新增 Passkey") },
      { status: 503 }
    );
  }

  const result = await requestPasskeyChange({
    action: "add",
    linkOrigin: getEnvValue("ORIGIN") || new URL(req.url).origin,
    ip: clientKey(req),
    ua: req.headers.get("user-agent") ?? "",
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, pending: true });
}
