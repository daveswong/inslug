/**
 * 浏览器端的上传逻辑，按图片存储方案分派。
 *
 * - vercel-blob：Vercel Blob 的直传协议，文件不进服务器
 * - s3：先要一张预签名表单，再由浏览器直接传到对象存储
 * - local：交给服务器写磁盘
 *
 * 这个文件不进 Node 运行时，浏览器和服务端都能引。
 */
import { upload } from "@vercel/blob/client";

export type ClientStorageProvider = "vercel-blob" | "s3" | "local";

export async function uploadImage(
  file: File,
  provider: ClientStorageProvider
): Promise<string> {
  if (provider === "s3") {
    const ticket = await fetch("/api/upload/s3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "上传失败");
      return data as { url: string; fields: Record<string, string>; publicUrl: string };
    });

    const form = new FormData();
    for (const [key, value] of Object.entries(ticket.fields)) {
      form.append(key, value);
    }
    form.append("file", file);
    const put = await fetch(ticket.url, { method: "POST", body: form });
    if (!put.ok) throw new Error("上传失败");
    return ticket.publicUrl;
  }

  if (provider === "local") {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload/local", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "上传失败");
    return String(data.url ?? "");
  }

  // Vercel Blob：浏览器直传，文件不经过服务器
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });
  return blob.url;
}
