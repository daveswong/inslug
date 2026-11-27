// 申请删除一把 Passkey：发确认邮件，确认页里才会真的删
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { listPasskeys } from "@/lib/passkey";
import { clientKey } from "@/lib/rate-limit";
import { mailReady, requestPasskeyChange } from "@/lib/change-request";
import { getT } from "@/lib/i18n";
import { getEnvValue } from "@/lib/env-config";

export async function POST(req: Request) {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: t("请先登录") }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { credentialId?: string };
  const credentialId = String(body.credentialId ?? "");
  if (!credentialId) {
    return NextResponse.json({ error: t("缺少凭据编号") }, { status: 400 });
  }

  const all = await listPasskeys();
  if (!all.some((key) => key.credentialId === credentialId)) {
    return NextResponse.json({ error: t("没有找到这把 Passkey") }, { status: 404 });
  }
  if (!(await mailReady())) {
    return NextResponse.json(
      { error: t("还没配好邮件确认，暂时不能删除 Passkey") },
      { status: 503 }
    );
  }

  const result = await requestPasskeyChange({
    action: "remove",
    credentialId,
    linkOrigin: getEnvValue("ORIGIN") || new URL(req.url).origin,
    ip: clientKey(req),
    ua: req.headers.get("user-agent") ?? "",
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, pending: true });
}
