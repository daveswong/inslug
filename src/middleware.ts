import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// 只保护两件事：写文章、站点设置。其余页面公开可读。
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let loggedIn = false;
  if (token) {
    try {
      loggedIn = await verifySessionToken(token);
    } catch {
      loggedIn = false;
    }
  }
  if (loggedIn) return NextResponse.next();

  const url = req.nextUrl.clone();
  const target = url.pathname + url.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(target)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/write", "/settings"],
};
