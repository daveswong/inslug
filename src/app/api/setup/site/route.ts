// 首次安装向导第 1 步：保存站点信息（都是展示型设置，不碰任何密钥）
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";

export async function POST(req: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    siteName?: string;
    description?: string;
    notifyEmail?: string;
    postsPerPage?: number | string;
  };

  const siteName = String(body.siteName ?? "").trim();
  if (!siteName) {
    return NextResponse.json({ error: "站点名不能为空" }, { status: 400 });
  }
  if (siteName.length > 80) {
    return NextResponse.json({ error: "站点名太长（最多 80 字）" }, { status: 400 });
  }

  const notifyEmail = String(body.notifyEmail ?? "").trim();
  if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
    return NextResponse.json({ error: "通知邮箱格式不对" }, { status: 400 });
  }

  const num = Number(body.postsPerPage);
  const postsPerPage = Number.isFinite(num)
    ? Math.min(50, Math.max(1, Math.round(num)))
    : 20;

  try {
    await saveSettings({
      siteName,
      description: String(body.description ?? "").trim(),
      notifyEmail,
      postsPerPage,
    });
  } catch {
    return NextResponse.json({ error: "保存失败：数据库异常" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
