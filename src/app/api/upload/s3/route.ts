// S3 兼容存储：生成预签名上传表单，浏览器直接传到对象存储，不经过服务器
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import {
  MAX_IMAGE_SIZE,
  createS3Ticket,
  isAllowedImageType,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t = await getT();

  if (!(await isLoggedIn())) {
    return NextResponse.json(
      { error: `${t("登录后才能上传图片")} [UNAUTHORIZED]` },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    filename?: string;
    contentType?: string;
    size?: number;
  } | null;

  if (!body?.filename || !body.contentType) {
    return NextResponse.json(
      { error: `${t("请求格式不正确")} [BAD_REQUEST]` },
      { status: 400 }
    );
  }
  if (!isAllowedImageType(body.contentType)) {
    return NextResponse.json(
      { error: `${t("只支持图片文件")} [BAD_TYPE]` },
      { status: 400 }
    );
  }
  if (typeof body.size === "number" && body.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: `${t("图片过大，请压缩后再传")} [TOO_LARGE]` },
      { status: 400 }
    );
  }

  try {
    const ticket = await createS3Ticket({
      filename: body.filename,
      contentType: body.contentType,
      size: body.size ?? 0,
    });
    return NextResponse.json(ticket);
  } catch (err) {
    const message = err instanceof Error ? err.message : t("上传失败");
    return NextResponse.json(
      { error: `${message} [UPLOAD_FAILED]` },
      { status: 400 }
    );
  }
}
