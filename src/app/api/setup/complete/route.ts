// 首次安装：环境变量配齐后标记初始化完成。
// 不自动登录——接下来跳到登录页，让站长用 RECOVERY_TOKEN 进门，
// 再去设置页配邮箱和身份验证。
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";
import { hasCredentials } from "@/app/setup/config-actions";

export const dynamic = "force-dynamic";

export async function POST() {
  const t = await getT();

  // 站点已有凭据 yet 未登录时，不能让陌生人把状态改成「已完成」。
  if (!(await isLoggedIn()) && (await hasCredentials())) {
    return NextResponse.json({ error: t("请先登录") }, { status: 401 });
  }

  try {
    await saveSettings({ setupCompleted: true });
  } catch {
    return NextResponse.json({ error: t("保存失败：数据库异常") }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
