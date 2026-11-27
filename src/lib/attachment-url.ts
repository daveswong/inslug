import type { ClientStorageProvider } from "./upload-client";

/**
 * 附件下载链接。
 *
 * 为什么要专门拼这个：附件可以是任意类型，其中有些浏览器会**直接渲染**
 * 而不是下载——HTML、SVG、XML、JSON、纯文本都属于这一类。
 * 渲染就意味着在你自己的域名下执行访客带来的脚本，
 * 拿到的就是你的会话 Cookie。
 *
 * 所以附件一律强制下载：
 * - vercel-blob：加 ?download=1（官方支持，忽略文件类型）
 * - s3：加 response-content-disposition（S3 标准参数，R2 / MinIO / AWS 都认）
 * - local：走 /uploads/ 路由，那边直接带 Content-Disposition: attachment
 */
export function attachmentDownloadUrl(
  url: string,
  name: string,
  provider: ClientStorageProvider
): string {
  if (provider === "vercel-blob") {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}download=1`;
  }

  if (provider === "s3") {
    const separator = url.includes("?") ? "&" : "?";
    // 文件名里的引号要转义，否则会把响应头拆坏
    const safeName = name.replace(/["\\]/g, "_");
    const disposition = encodeURIComponent(
      `attachment; filename="${safeName}"`
    );
    return `${url}${separator}response-content-disposition=${disposition}`;
  }

  // local：站内路由认 ?download=1，强制下载并用原文件名
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}download=1&filename=${encodeURIComponent(name)}`;
}
