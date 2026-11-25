/**
 * 上传前的浏览器端图片处理：大图降采样到 2000px 以内并重新编码，
 * 手机拍照动辄 4000px / 5MB，直接丢进 Blob 既慢又费流量。
 *
 * GIF（可能是动图）和 SVG 原样上传，否则动画会丢。
 */

const MAX_EDGE = 2000;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];

export async function prepareImage(file: File): Promise<File> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("IMAGE_TYPE_NOT_ALLOWED");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("IMAGE_TOO_LARGE_CLIENT");
  }
  if (
    file.type === "image/gif" ||
    file.type === "image/svg+xml" ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  // 尺寸不大且体积已经够小，就不重新编码（避免 PNG 越压越大）
  if (longest <= MAX_EDGE && file.size <= 1.5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / longest);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 有透明通道且原图是 PNG 就保留 PNG，其余统一 webp（体积小得多）
  const usePng = file.type === "image/png";
  const mime = usePng ? "image/png" : "image/webp";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, usePng ? undefined : 0.82)
  );
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + (usePng ? ".png" : ".webp");
  return new File([blob], name, { type: mime });
}
