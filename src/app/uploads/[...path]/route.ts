// 本地磁盘存储的文件访问路由（仅 local 方案用到）
import { readFile } from "node:fs/promises";
import { contentTypeByExt, localUploadDir, resolveLocalUploadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * 拼一个安全的 Content-Disposition。
 *
 * 文件名是用户给的，直接塞进响应头会被换行注入（响应头拆分），
 * 也可能被浏览器当成路径。所以：
 * - filename 给一份清洗过的 ASCII 版（浏览器的老式回退）
 * - filename* 给原始名（RFC 5987 的 URI 编码，中文名靠它才不乱码）
 */
function contentDisposition(fileName: string): string {
  const ascii = fileName
    // 去掉控制字符和引号，防止响应头被拆坏
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .slice(0, 120);
  const encoded = encodeURIComponent(fileName).slice(0, 300);
  return `attachment; filename="${ascii || "download"}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const relative = (path ?? []).join("/");
  if (!relative) return new Response("Not found", { status: 404 });

  const base = await localUploadDir();
  const target = resolveLocalUploadPath(relative, base);
  // 越界（../）直接拒绝
  if (!target) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  // 附件链接带 ?download=1：强制下载，不让浏览器拿你域名去渲染它
  const wantsDownload = url.searchParams.get("download") === "1";
  // 原始文件名由调用方给（附件列表里存着），只是显示用
  const rawName = url.searchParams.get("filename") ?? "";
  const originalName = rawName.slice(0, 200);

  try {
    const data = await readFile(target);
    const type = contentTypeByExt(target);
    const headers: Record<string, string> = {
      "content-type": type,
      // 文件名带随机串，内容不会变，可以长期缓存
      "cache-control": "public, max-age=31536000, immutable",
      // 别让浏览器自己猜类型——猜错了就能绕过上面的下载限制
      "x-content-type-options": "nosniff",
    };
    if (wantsDownload) {
      headers["content-disposition"] = contentDisposition(
        originalName || target.split("/").pop() || "download"
      );
    }
    return new Response(new Uint8Array(data), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
