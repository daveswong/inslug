"use server";

import { revalidatePath } from "next/cache";
import type { Block } from "@blocknote/core";
import { isLoggedIn } from "@/lib/auth";
import { createPost, deletePost, updatePost, SlugConflictError } from "@/lib/posts";
import { normalizeCustomSlug } from "@/lib/slug";
import type { Visibility } from "@/lib/types";
import { getT } from "@/lib/i18n";

export type SaveResult = { ok: true; slug: string } | { ok: false; error: string };

// 写作页的保存：有 slug 走更新，没有就新建。
// proxy.ts 只挡页面请求，server action 是另一个入口，这里必须自己再校验一次。
export async function savePost(input: {
  slug: string | null;
  customSlug: string;
  title: string;
  blocks: Block[];
  tags: string[];
  visibility: Visibility;
  pinned: boolean;
}): Promise<SaveResult> {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return { ok: false, error: t("登录已过期，请重新登录后再保存") };
  }

  const title = input.title.trim();
  if (!title) return { ok: false, error: t("先写个标题吧") };

  // 用户填的地址统一规范化；留空则由数据库自动生成（新建）或保持原样（编辑）
  const customSlug = normalizeCustomSlug(input.customSlug);

  const payload = {
    title,
    blocks: input.blocks,
    tags: input.tags,
    visibility: input.visibility,
    pinned: input.pinned,
  };

  try {
    if (input.slug) {
      const updated = await updatePost(input.slug, {
        ...payload,
        newSlug: customSlug,
      });
      if (!updated) return { ok: false, error: t("文章不存在，可能已被删除") };
      revalidatePath("/");
      // 地址改了，旧地址也要清缓存，免得访客还能从旧链接看到内容
      if (updated.slug !== input.slug) revalidatePath(`/posts/${input.slug}`);
      revalidatePath(`/posts/${updated.slug}`);
      return { ok: true, slug: updated.slug };
    }

    const created = await createPost({ ...payload, customSlug });
    revalidatePath("/");
    return { ok: true, slug: created.slug };
  } catch (err) {
    if (err instanceof SlugConflictError) {
      return { ok: false, error: t("这个地址已被占用，换一个吧") };
    }
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
