// 本地磁盘存储的图片访问路由（仅 local 方案用到）
import { readFile } from "node:fs/promises";
import { contentTypeByExt, localUploadDir, resolveLocalUploadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const relative = (path ?? []).join("/");
  if (!relative) return new Response("Not found", { status: 404 });

  const base = await localUploadDir();
  const target = resolveLocalUploadPath(relative, base);
  // 越界（../）直接拒绝
  if (!target) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(target);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": contentTypeByExt(target),
        // 文件名带随机串，内容不会变，可以长期缓存
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
