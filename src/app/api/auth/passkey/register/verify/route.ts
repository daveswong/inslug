// 注册新的 Passkey：校验注册结果并入库
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture, RegistrationResponseJSON } from "@simplewebauthn/server";
import { addPasskey, listPasskeys, rpConfig, toBase64Url } from "@/lib/passkey";
import { isLoggedIn } from "@/lib/auth";
import { CHALLENGE_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const jar = await cookies();
  const expectedChallenge = jar.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "验证已过期，请重试" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON;
    name?: string;
  };
  if (!body.response) {
    return NextResponse.json({ error: "缺少注册数据" }, { status: 400 });
  }

  const { rpID, origin } = rpConfig(req);

  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "注册失败" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    await addPasskey({
      credentialId: credential.id,
      publicKey: toBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransportFuture[] | undefined,
    });

    jar.delete(CHALLENGE_COOKIE);
    return NextResponse.json({ ok: true, count: (await listPasskeys()).length });
  } catch {
    return NextResponse.json({ error: "注册失败，请重试" }, { status: 400 });
  }
}
