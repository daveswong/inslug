import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getServiceValue } from "./service-config";

/**
 * 图片存储的可插拔实现。
 *
 * 三种方案，靠 STORAGE_PROVIDER 选：
 * - vercel-blob：Vercel Blob，浏览器直传（Vercel 部署最省事，推荐）
 * - s3：任何 S3 兼容服务（Cloudflare R2 / MinIO / AWS S3 / OSS…），浏览器预签名直传
 * - local：写服务器磁盘，程序自己提供访问路由（自建服务器最省事）
 *
 * 这个模块引了 node:fs 和 AWS SDK，只能在服务端用。
 * 客户端只知道 provider 的名字（由服务端作为 props 传下去）。
 */

export type StorageProvider = "vercel-blob" | "s3" | "local";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function isAllowedImageType(type: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(type);
}

/** 当前选的图片存储方案。没配就是 vercel-blob（默认最省事的那条路） */
export async function getStorageProvider(): Promise<StorageProvider> {
  const raw = (await getServiceValue("STORAGE_PROVIDER"))?.trim().toLowerCase();
  if (raw === "s3" || raw === "local" || raw === "vercel-blob") return raw;
  return "vercel-blob";
}

/** 这个方案需要的配置是不是齐了 */
export async function isStorageConfigured(
  provider: StorageProvider
): Promise<boolean> {
  const has = async (key: string) =>
    Boolean((await getServiceValue(key))?.trim());
  if (provider === "vercel-blob") return has("BLOB_READ_WRITE_TOKEN");
  if (provider === "local") return true; // 本地磁盘不需要任何凭据
  return (
    (await has("S3_BUCKET")) &&
    (await has("S3_ACCESS_KEY_ID")) &&
    (await has("S3_SECRET_ACCESS_KEY")) &&
    (await has("S3_PUBLIC_URL"))
  );
}

/** 本地磁盘方案的存放目录（相对项目根目录） */
export async function localUploadDir(): Promise<string> {
  const dir = (await getServiceValue("LOCAL_UPLOAD_DIR"))?.trim();
  return dir && dir.length > 0 ? dir : "uploads";
}

/**
 * 本地磁盘：把图片写进 uploads 目录，返回站内地址。
 *
 * 文件名用随机串，避免撞名，也避免用户上传的文件名带路径。
 */
export async function saveLocalImage(
  file: File
): Promise<{ url: string }> {
  const dir = resolve(process.cwd(), await localUploadDir());
  await mkdir(dir, { recursive: true });

  const ext = fileExt(file.name, file.type);
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}${ext}`;
  const target = join(dir, name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(target, buffer);
  return { url: `/uploads/${name}` };
}

/** 把请求解析成 uploads 目录内的绝对路径；越界（../）一律拒绝 */
export function resolveLocalUploadPath(
  relative: string,
  baseDir: string
): string | null {
  const base = resolve(process.cwd(), baseDir);
  const target = resolve(base, relative);
  if (target !== base && !target.startsWith(base + sep)) return null;
  return target;
}

/** 按扩展名猜 Content-Type，读本地文件时用 */
export function contentTypeByExt(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  return map[ext] ?? "application/octet-stream";
}

function fileExt(originalName: string, mime: string): string {
  const fromName = originalName.includes(".")
    ? originalName.slice(originalName.lastIndexOf(".")).toLowerCase()
    : "";
  if (fromName && fromName.length <= 6 && /^\.[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico",
  };
  return map[mime] ?? "";
}

/** S3 方案的预签名直传参数 */
export type S3Ticket = {
  /** 预签名表单的目标地址 */
  url: string;
  /** 表单里要带的字段 */
  fields: Record<string, string>;
  /** 存进去之后的公开地址 */
  publicUrl: string;
};

/**
 * 生成 S3 的预签名 POST 表单，浏览器拿它直接传到对象存储，不经过服务器。
 */
export async function createS3Ticket(input: {
  filename: string;
  contentType: string;
  size: number;
}): Promise<S3Ticket> {
  const [endpoint, region, bucket, accessKeyId, secretAccessKey, publicUrl] =
    await Promise.all([
      getServiceValue("S3_ENDPOINT"),
      getServiceValue("S3_REGION"),
      getServiceValue("S3_BUCKET"),
      getServiceValue("S3_ACCESS_KEY_ID"),
      getServiceValue("S3_SECRET_ACCESS_KEY"),
      getServiceValue("S3_PUBLIC_URL"),
    ]);

  if (!bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error("S3 存储配置不完整");
  }

  const client = new S3Client({
    region: region?.trim() || "us-east-1",
    // 自建 / R2 给自己的接入地址；AWS 本身留空
    endpoint: endpoint?.trim() || undefined,
    // MinIO 这类自建服务用路径风格更稳
    forcePathStyle: Boolean(endpoint?.trim()),
    credentials: { accessKeyId, secretAccessKey },
  });

  const key = `uploads/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}${fileExt(
    input.filename,
    input.contentType
  )}`;

  const { url, fields } = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Expires: 300, // 表单 5 分钟内有效
    Fields: { "Content-Type": input.contentType },
    Conditions: [
      ["content-length-range", 0, MAX_IMAGE_SIZE],
      ["eq", "$Content-Type", input.contentType],
    ],
  });

  const base = publicUrl.replace(/\/+$/, "");
  return { url, fields, publicUrl: `${base}/${key}` };
}
