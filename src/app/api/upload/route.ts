// 图片上传：只签发上传令牌，文件由浏览器直传 Vercel Blob，不经过服务器内存
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const t = await getT();
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json(
      { error: `${t("请求格式不正确")} [BAD_REQUEST]` },
      { status: 400 }
    );
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      // 没有这个判断就等于开了个公开图床，任何人都能往你的 store 里塞文件
      onBeforeGenerateToken: async () => {
        if (!(await isLoggedIn())) {
          // 末尾的英文标记是给前端判断用的：界面语言变了，这个标记也稳定
          throw new Error(`${t("登录后才能上传图片")} [UNAUTHORIZED]`);
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : t("上传失败");
    return NextResponse.json(
      { error: /[A-Z_]+]/.test(message) ? message : `${message} [UPLOAD_FAILED]` },
      { status: 400 }
    );
  }
}
