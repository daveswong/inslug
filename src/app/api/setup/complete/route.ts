// 首次安装向导最后一步：标记初始化完成
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n";

export async function POST() {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: t("请先登录") }, { status: 401 });
  }
  try {
    await saveSettings({ setupCompleted: true });
  } catch {
    return NextResponse.json({ error: t("保存失败：数据库异常") }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
