// 首次安装向导最后一步：标记初始化完成，并保证浏览器是登录状态
import { NextResponse } from "next/server";
import { isLoggedIn, startSession } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { getEnvValue } from "@/lib/env-config";
import { getT } from "@/lib/i18n";

export async function POST() {
  const t = await getT();

  try {
    await saveSettings({ setupCompleted: true });
  } catch {
    return NextResponse.json({ error: t("保存失败：数据库异常") }, { status: 503 });
  }

  // 装完直接进设置页，所以这时得是登录状态。
  // 免登录走完安装的人还没有会话——服务端自己知道 RECOVERY_TOKEN
  // （那是站长自己配的、存在服务端环境变量里的），用它给这台浏览器换一张票。
  if (!(await isLoggedIn())) {
    const recovery = getEnvValue("RECOVERY_TOKEN");
    if (recovery && recovery.length >= 16) {
      await startSession();
    }
  }

  return NextResponse.json({ ok: true });
}
