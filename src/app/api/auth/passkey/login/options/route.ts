// Passkey 登录第一步：给出挑战
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { listPasskeys, rpConfig } from "@/lib/passkey";
import { CHALLENGE_COOKIE, COOKIE_OPTIONS } from "@/lib/session";

export async function GET(req: Request) {
  const { rpID } = rpConfig(req);
  const passkeys = await listPasskeys();

  if (passkeys.length === 0) {
    return NextResponse.json(
      { error: "还没有绑定 Passkey，请先用验证器登录并在设置里添加" },
      { status: 400 }
    );
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransportFuture[] | undefined,
    })),
    userVerification: "preferred",
  });

  // 挑战 5 分钟内有效，存在 httpOnly cookie 里
  (await cookies()).set(CHALLENGE_COOKIE, options.challenge, {
    ...COOKIE_OPTIONS,
    maxAge: 300,
  });

  return NextResponse.json(options);
}
