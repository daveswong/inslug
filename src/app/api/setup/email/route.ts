// 安装第一步：填邮箱 → 发确认信。点信里的链接才把邮箱写进设置。
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { requestSetupEmail } from "@/lib/change-request";
import { clientKey } from "@/lib/rate-limit";
import { getEnvValue } from "@/lib/env-config";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t = await getT();

  // 安装还没走完时可能还没登录，但这一步要能走——
  // 免登录放行只在「站点上还没有任何凭据」时成立，
  // 这里跟着同样的判断，不给别的人口子。
  if (!(await isLoggedIn())) {
    const { hasCredentials } = await import("@/app/setup/config-actions");
    if (await hasCredentials()) {
      return NextResponse.json({ error: t("请先登录") }, { status: 401 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: t("先填个邮箱") }, { status: 400 });
  }

  const result = await requestSetupEmail({
    email,
    linkOrigin: getEnvValue("ORIGIN") || new URL(req.url).origin,
    ip: clientKey(req),
    ua: req.headers.get("user-agent") ?? "",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
