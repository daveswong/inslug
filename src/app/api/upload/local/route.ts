// 本地磁盘存储：图片由服务器写入 uploads 目录
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import {
  MAX_IMAGE_SIZE,
  isAllowedImageType,
  saveLocalImage,
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

  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    file = null;
  }

  if (!file) {
    return NextResponse.json(
      { error: `${t("请求格式不正确")} [BAD_REQUEST]` },
      { status: 400 }
    );
  }
  if (!isAllowedImageType(file.type)) {
    return NextResponse.json(
      { error: `${t("只支持图片文件")} [BAD_TYPE]` },
      { status: 400 }
    );
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: `${t("图片过大，请压缩后再传")} [TOO_LARGE]` },
      { status: 400 }
    );
  }

  try {
    const saved = await saveLocalImage(file);
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : t("上传失败");
    return NextResponse.json(
      { error: `${message} [UPLOAD_FAILED]` },
      { status: 400 }
    );
  }
}
