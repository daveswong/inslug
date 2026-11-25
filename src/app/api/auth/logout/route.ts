// 退出登录：清掉会话 cookie 后回到首页（表单直接 POST，不需要前端 JS）
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
