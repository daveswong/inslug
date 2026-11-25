import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-constants";

// 只保护写文章、站点设置。安装向导 /setup 的第一步（服务器配置）在没有任何凭据时
// 必须能免登录打开，否则新部署没有数据库地址就进不去，所以由页面自己判断。
// 这里只验签名与过期：Edge 运行时连不了 MongoDB，会话版本号的比对放在 Node 侧（isLoggedIn）。
export async function middleware(req: NextRequest) {
  // Edge 运行时读不到 .env 文件，没法在这里验签，所以只做「有没有会话」的粗筛。
  // 真正的验签（含会话版本号比对）在 Node 侧的 isLoggedIn()，
  // /write 与 /settings 页面都会再校验一次，伪造 cookie 进不去。
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
