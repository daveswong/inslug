// Passkey 登录第二步：校验签名
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { findPasskey, fromBase64Url, rpConfig, touchPasskey } from "@/lib/passkey";
import { startSession } from "@/lib/auth";
import { CHALLENGE_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const jar = await cookies();
  const expectedChallenge = jar.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "验证已过期，请重新登录" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    response?: AuthenticationResponseJSON;
  };
  if (!body.response) {
    return NextResponse.json({ error: "缺少认证数据" }, { status: 400 });
  }

  const passkey = await findPasskey(body.response.id);
  if (!passkey) {
    return NextResponse.json({ error: "没有找到这把 Passkey" }, { status: 404 });
  }

  const { rpID, origin } = rpConfig(req);

  try {
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: fromBase64Url(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[] | undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "验证失败" }, { status: 401 });
    }

    await touchPasskey(passkey.credentialId, verification.authenticationInfo.newCounter);
    jar.delete(CHALLENGE_COOKIE);
    await startSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "验证失败，请重试" }, { status: 400 });
  }
}
