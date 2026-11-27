"use server";

import { revalidatePath } from "next/cache";
import type { Block } from "@blocknote/core";
import { isLoggedIn } from "@/lib/auth";
import { createPost, deletePost, updatePost } from "@/lib/posts";
import type { Attachment, Visibility } from "@/lib/types";
import { getT } from "@/lib/i18n";

export type SaveResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * 校验并清洗附件列表。
 *
 * 附件数据是客户端传上来的，不能照单全收：
 * - url 必须是站内地址（/uploads/...）或对象存储的 http(s) 地址，
 *   否则等于允许往文章里塞任意链接（javascript: 伪协议尤其要挡）
 * - 文件名和大小要限长，别让文章文档无限膨胀
 */
function sanitizeAttachments(
  input: Attachment[] | undefined
): Attachment[] | null {
  if (!input) return [];
  if (!Array.isArray(input)) return null;
  if (input.length > 50) return null;

  const clean: Attachment[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const name = String(item.name ?? "").trim();
    const url = String(item.url ?? "").trim();
    const size = Number(item.size);
    if (!name || name.length > 200) return null;
    if (!url || url.length > 2000) return null;
    // 站内路径 或 http(s) 绝对地址，其余（javascript:、data: 等）一律拒绝
    const isLocal = url.startsWith("/") && !url.startsWith("//");
    const isRemote = /^https?:\/\//i.test(url);
    if (!isLocal && !isRemote) return null;
    if (!Number.isFinite(size) || size < 0 || size > 50 * 1024 * 1024) {
      return null;
    }
    clean.push({
      name,
      url,
      size,
      type: String(item.type ?? "application/octet-stream").slice(0, 120),
    });
  }
  return clean;
}

// 写作页的保存：有 slug 走更新，没有就新建。
// proxy.ts 只挡页面请求，server action 是另一个入口，这里必须自己再校验一次。
export async function savePost(input: {
  slug: string | null;
  title: string;
  blocks: Block[];
  tags: string[];
  visibility: Visibility;
  pinned: boolean;
  attachments?: Attachment[];
}): Promise<SaveResult> {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return { ok: false, error: t("登录已过期，请重新登录后再保存") };
  }

  const title = input.title.trim();
  if (!title) return { ok: false, error: t("先写个标题吧") };

  const attachments = sanitizeAttachments(input.attachments);
  if (attachments === null) {
    return { ok: false, error: t("附件信息不对，保存失败") };
  }

  const payload = {
    title,
    blocks: input.blocks,
    tags: input.tags,
    visibility: input.visibility,
    pinned: input.pinned,
    attachments,
  };

  try {
    if (input.slug) {
      const updated = await updatePost(input.slug, payload);
      if (!updated) return { ok: false, error: t("文章不存在，可能已被删除") };
      revalidatePath("/");
      revalidatePath(`/posts/${input.slug}`);
      return { ok: true, slug: input.slug };
    }

    const created = await createPost(payload);
    revalidatePath("/");
    return { ok: true, slug: created.slug };
  } catch {
    return { ok: false, error: t("保存失败：数据库连接异常") };
  }
}

/** 删除文章。二次确认在客户端做，服务端只负责校验登录与执行。 */
export async function deletePostAction(
  slug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return { ok: false, error: t("登录已过期，请重新登录") };
  }
  try {
    const removed = await deletePost(slug);
    if (!removed) return { ok: false, error: t("文章不存在，可能已被删除") };
    revalidatePath("/");
    revalidatePath(`/posts/${slug}`);
    return { ok: true };
  } catch {
    return { ok: false, error: t("删除失败：数据库连接异常") };
  }
}
