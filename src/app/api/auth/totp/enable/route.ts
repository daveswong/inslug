/**
 * 绑定验证器。
 *
 * 验过 6 位码后**一律发确认邮件**，点邮件里的链接才真正生效。
 * 首次绑定和换绑走同一条路：
 * - 换绑：旧验证器会立刻失效，多一道确认是必须的
 * - 首次绑定：同样是给账号加一把钥匙，走一样的流程更一致，
 *   也免得「码验过了就生效」——万一这个码是被别人看到的
 *   （比如你把手机屏幕亮给别人看），对方就能直接绑一把自己的验证器
 */
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { getAuth } from "@/lib/credentials";
import { sealValue } from "@/lib/secret-box";
import { verifyCode } from "@/lib/totp";
import { clientKey } from "@/lib/rate-limit";
import { mailReady, requestTotpChange } from "@/lib/change-request";
import { getT } from "@/lib/i18n";
import { getEnvValue } from "@/lib/env-config";

export async function POST(req: Request) {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: t("请先登录") }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    secret?: string;
    code?: string;
  };
  const secret = typeof body.secret === "string" ? body.secret.trim().toUpperCase() : "";
  const code = typeof body.code === "string" ? body.code : "";

  // secret 是 base32，长度太短说明不是我们发出去的
  if (!/^[A-Z2-7]{16,64}$/.test(secret)) {
    return NextResponse.json({ error: t("密钥格式不对，请重新生成") }, { status: 400 });
  }

  if (!verifyCode(secret, code, null).ok) {
    return NextResponse.json(
      { error: t("验证码不对。手机上的那条必须对应本页显示的密钥，重新扫一次二维码。") },
      { status: 401 }
    );
  }

  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: t("数据库暂时不可用，稍后再试") }, { status: 503 });
  }

  const sealed = sealValue(secret);

  // 没配好邮件通道就动不了手：绑定必须能被邮件确认
  if (!(await mailReady())) {
    return NextResponse.json(
      { error: t("还没配好邮件确认，暂时不能绑定验证器") },
      { status: 503 }
    );
  }

  // 首次绑定和换绑都发确认信，确认页才真正写库
  const result = await requestTotpChange({
    action: "set",
    sealedSecret: sealed,
    linkOrigin: getEnvValue("ORIGIN") || new URL(req.url).origin,
    ip: clientKey(req),
    ua: req.headers.get("user-agent") ?? "",
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, pending: true });
}
