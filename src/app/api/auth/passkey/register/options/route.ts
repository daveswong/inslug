// 注册新的 Passkey（需先登录）：给出注册挑战
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { listPasskeys, rpConfig } from "@/lib/passkey";
import { isLoggedIn } from "@/lib/auth";
import { CHALLENGE_COOKIE, COOKIE_OPTIONS } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { rpID } = rpConfig(req);
  const passkeys = await listPasskeys();

  const options = await generateRegistrationOptions({
    rpName: "inslug",
    rpID,
    userName: "owner",
    userDisplayName: "站长",
    attestationType: "none",
    excludeCredentials: passkeys.map((p) => ({ id: p.credentialId })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  (await cookies()).set(CHALLENGE_COOKIE, options.challenge, {
    ...COOKIE_OPTIONS,
    maxAge: 300,
  });

  return NextResponse.json(options);
}
