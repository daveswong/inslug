import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// 只保护两件事：写文章、站点设置。其余页面公开可读。
// 这里只验签名与过期：Edge 运行时连不了 MongoDB，会话版本号的比对放在 Node 侧（isLoggedIn）。
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (payload) return NextResponse.next();

  const url = req.nextUrl.clone();
  const target = url.pathname + url.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(target)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/write", "/settings"],
};
