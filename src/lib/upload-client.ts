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

/** 上传的是图片还是附件。附件不限类型，图片才查白名单 */
export type UploadKind = "image" | "attachment";

export async function uploadImage(
  file: File,
  provider: ClientStorageProvider
): Promise<string> {
  return uploadFile(file, provider, "image");
}

/**
 * 上传一个文件，返回可访问的地址。
 *
 * 图片和附件走同一条路，只是服务端查不查类型白名单、大小上限不同。
 */
export async function uploadFile(
  file: File,
  provider: ClientStorageProvider,
  kind: UploadKind = "image"
): Promise<string> {
  if (provider === "s3") {
    const ticket = await fetch("/api/upload/s3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        kind,
      }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "上传失败");
      return data as {
        url: string;
        fields: Record<string, string>;
        publicUrl: string;
      };
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
    form.append("kind", kind);
    const res = await fetch("/api/upload/local", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "上传失败");
    return String(data.url ?? "");
  }

  // Vercel Blob：浏览器直传，文件不经过服务器。
  // clientPayload 会原样送到服务端的 onBeforeGenerateToken，
  // 用来告诉服务端这次是图片还是附件。
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    clientPayload: kind,
  });
  return blob.url;
}
