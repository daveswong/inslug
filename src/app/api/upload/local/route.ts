// 本地磁盘存储：文件由服务器写入 uploads 目录
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import {
  MAX_ATTACHMENT_SIZE,
  MAX_IMAGE_SIZE,
  isAllowedImageType,
  saveLocalFile,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t = await getT();

  if (!(await isLoggedIn())) {
    return NextResponse.json(
      { error: `${t("登录后才能上传文件")} [UNAUTHORIZED]` },
      { status: 401 }
    );
  }

  let file: File | null = null;
  let kind = "image";
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
    const kindEntry = form.get("kind");
    if (typeof kindEntry === "string") kind = kindEntry;
  } catch {
    file = null;
  }

  if (!file) {
    return NextResponse.json(
      { error: `${t("请求格式不正确")} [BAD_REQUEST]` },
      { status: 400 }
    );
  }

  // 附件不限类型，只卡大小；图片仍然只收图片类型
  const isAttachment = kind === "attachment";
  if (!isAttachment && !isAllowedImageType(file.type)) {
    return NextResponse.json(
      { error: `${t("只支持图片文件")} [BAD_TYPE]` },
      { status: 400 }
    );
  }
  const maxSize = isAttachment ? MAX_ATTACHMENT_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json(
      {
        error: isAttachment
          ? `${t("附件太大，单个不能超过 50MB")} [TOO_LARGE]`
          : `${t("图片过大，请压缩后再传")} [TOO_LARGE]`,
      },
      { status: 400 }
    );
  }

  try {
    const saved = await saveLocalFile(file);
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : t("上传失败");
    return NextResponse.json(
      { error: `${message} [UPLOAD_FAILED]` },
      { status: 400 }
    );
  }
}
