"use server";

import { revalidatePath } from "next/cache";
import type { Block } from "@blocknote/core";
import { createPost, updatePost } from "@/lib/posts";
import type { Visibility } from "@/lib/types";

export type SaveResult = { ok: true; slug: string } | { ok: false; error: string };

// 写作页的保存：有 slug 走更新，没有就新建
// TODO 鉴权接入后，这里必须先校验登录状态再写库
export async function savePost(input: {
  slug: string | null;
  title: string;
  blocks: Block[];
  tags: string[];
  visibility: Visibility;
}): Promise<SaveResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "先写个标题吧" };

  const payload = {
    title,
    blocks: input.blocks,
    tags: input.tags,
    visibility: input.visibility,
  };

  try {
    if (input.slug) {
      const updated = await updatePost(input.slug, payload);
      if (!updated) return { ok: false, error: "文章不存在，可能已被删除" };
      revalidatePath("/");
      revalidatePath(`/posts/${input.slug}`);
      return { ok: true, slug: input.slug };
    }

    const created = await createPost(payload);
    revalidatePath("/");
    return { ok: true, slug: created.slug };
  } catch {
    return { ok: false, error: "保存失败：数据库连接异常" };
  }
}
