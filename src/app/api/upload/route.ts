// 上传：只签发上传令牌，文件由浏览器直传 Vercel Blob，不经过服务器内存
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isLoggedIn } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getServiceValue } from "@/lib/service-config";
import { MAX_ATTACHMENT_SIZE, MAX_IMAGE_SIZE } from "@/lib/storage";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

/**
 * 附件不限制类型。
 *
 * Blob 的 allowedContentTypes 传空数组表示不限制，
 * 但仍要卡大小——50MB 是给附件的，图片另算 10MB。
 */
export async function POST(req: Request) {
  const t = await getT();
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json(
      { error: `${t("请求格式不正确")} [BAD_REQUEST]` },
      { status: 400 }
    );
  }

  // 显式把令牌传给 SDK，不修改 process.env：前台请求绝不能写环境变量。
  const blobToken = await getServiceValue("BLOB_READ_WRITE_TOKEN");

  try {
    const result = await handleUpload({
      body,
      request: req,
      token: blobToken || undefined,
      // 没有这个判断就等于开了个公开图床，任何人都能往你的 store 里塞文件
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!(await isLoggedIn())) {
          // 末尾的英文标记是给前端判断用的：界面语言变了，这个标记也稳定
          throw new Error(`${t("登录后才能上传文件")} [UNAUTHORIZED]`);
        }
        // 客户端通过 clientPayload 传「image」还是「attachment」
        const isAttachment = clientPayload === "attachment";
        return {
          // 附件不限类型：allowedContentTypes 不传就是不限，
          // 传空数组反而是什么都不许传。
          ...(isAttachment
            ? {}
            : { allowedContentTypes: ALLOWED_IMAGE_TYPES }),
          maximumSizeInBytes: isAttachment
            ? MAX_ATTACHMENT_SIZE
            : MAX_IMAGE_SIZE,
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
