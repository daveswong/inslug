/**
 * 绑定验证器。
 *
 * 首次绑定（库里还没有 secret）：验过 6 位码就直接生效。
 * 换绑（已经有一把）：验过码之后还要过邮件确认，确认页点「确认执行」才写库。
 *
 * 为什么规则不一样：危险的不是「多一把钥匙」，是「换掉/拿走已有的钥匙」。
 * 首次绑定时账号上只有 Passkey，多绑一把 TOTP 不会让操作者失去任何东西；
 * 换绑则会让旧验证器立刻失效，所以要多一道确认。
 */
import { NextResponse } from "next/server";
import { isLoggedIn, startSession } from "@/lib/auth";
import { getAuth, setTotpSecret } from "@/lib/credentials";
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
    return NextResponse.json({ error: t("验证码不对，确认手机时间和内容后再试") }, { status: 401 });
  }

  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: t("数据库暂时不可用，稍后再试") }, { status: 503 });
  }

  const sealed = sealValue(secret);

  // 首次绑定：直接生效。
  // 判断依据是「数据库里有没有密文」，不是「能不能解开」——
  // 解不开说明密钥换过或密文损坏，那是「绑过但坏了」，
  // 当成没绑过会让这次操作绕过邮件确认，直接覆盖掉原来的验证器。
  if (!auth.totpBound) {
    await setTotpSecret(sealed);
    await startSession(); // sv 变了，顺手给当前浏览器换一张新票
    return NextResponse.json({ ok: true, bound: true });
  }

  // 换绑：先发确认信
  if (!(await mailReady())) {
    return NextResponse.json(
      { error: t("还没配好邮件确认，暂时不能更换验证器") },
      { status: 503 }
    );
  }

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
