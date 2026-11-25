"use server";

import { revalidatePath } from "next/cache";
import type { Block } from "@blocknote/core";
import { isLoggedIn } from "@/lib/auth";
import { createPost, deletePost, updatePost } from "@/lib/posts";
import type { Visibility } from "@/lib/types";
import { getT } from "@/lib/i18n";

export type SaveResult = { ok: true; slug: string } | { ok: false; error: string };

// 写作页的保存：有 slug 走更新，没有就新建。
// middleware 只挡页面请求，server action 是另一个入口，这里必须自己再校验一次。
export async function savePost(input: {
  slug: string | null;
  title: string;
  blocks: Block[];
  tags: string[];
  visibility: Visibility;
}): Promise<SaveResult> {
  const t = await getT();
  if (!(await isLoggedIn())) {
    return { ok: false, error: t("登录已过期，请重新登录后再保存") };
  }

  const title = input.title.trim();
  if (!title) return { ok: false, error: t("先写个标题吧") };

  const payload = {
    title,
    blocks: input.blocks,
    tags: input.tags,
    visibility: input.visibility,
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
