import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-constants";

// 只保护写文章、站点设置。安装向导 /setup 的第一步（服务器配置）在没有任何凭据时
// 必须能免登录打开，否则新部署没有数据库地址就进不去，所以由页面自己判断。
// 这里只做「有没有会话 cookie」的粗筛；真正的验签（含会话版本号比对）
// 集中在页面层的 isLoggedIn()，两处不重复实现。
export async function proxy(req: NextRequest) {
  // proxy 固定跑在 Node.js 运行时，但这里刻意不验签：
  // 验签只有 isLoggedIn() 一个入口，/write 与 /settings 页面都会再校验一次，
  // 伪造 cookie 进不去。这样配置文件读写不用碰这里，逻辑也只留一份。
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  const target = url.pathname + url.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(target)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/write", "/settings"],
};
