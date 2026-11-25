// 生成一把新的验证器 secret，只返回给已登录的浏览器，不落库
// 落库发生在 /api/auth/totp/enable，且必须先验过一次 6 位码
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { groupSecret, newSecret, otpauthUri, qrSvg } from "@/lib/totp";

export async function POST() {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const secret = newSecret();
  const qrSvgString = await qrSvg(otpauthUri(secret));
  return NextResponse.json({
    secret,
    grouped: groupSecret(secret),
    qrSvg: qrSvgString,
  });
}
