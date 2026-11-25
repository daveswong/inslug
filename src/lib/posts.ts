import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import type { PostDoc, Visibility } from "./types";

/** 从 BlockNote 块里提取纯文本，供搜索使用 */
function blocksToPlainText(blocks: unknown[]): string {
  const parts: string[] = [];
  const walk = (items: unknown[]) => {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const block = item as Record<string, unknown>;
      const content = block.content;
      if (typeof content === "string") {
        parts.push(content);
      } else if (Array.isArray(content)) {
        for (const c of content) {
          if (
            c &&
            typeof c === "object" &&
            typeof (c as Record<string, unknown>).text === "string"
          ) {
            parts.push((c as Record<string, unknown>).text as string);
          }
        }
      }
      if (Array.isArray(block.children)) walk(block.children);
    }
  };
  walk(blocks);
  return parts.join(" ");
}

/** 生成短 ID 作为 slug（自动短 ID 方案） */
function newSlug(): string {
  return new ObjectId().toString("hex").slice(0, 12);
}

/** 定稿时间：public 和 private 都算定稿，draft 为 null */
function publishedAtFor(v: Visibility, existing: Date | null, now: Date): Date | null {
  if (v === "draft") return null;
  if (v === "public") return existing ?? now;
  // private：首次设为私有时记时间，之后保留
  return existing ?? now;
}

export async function createPost(input: {
  title: string;
  blocks: unknown[];
  tags: string[];
  visibility: Visibility;
}): Promise<PostDoc> {
  const db = await getDb();
  const now = new Date();
  const doc: PostDoc = {
    slug: newSlug(),
    title: input.title,
    blocks: input.blocks as PostDoc["blocks"],
    plainText: blocksToPlainText(input.blocks),
    tags: input.tags,
    visibility: input.visibility,
    publishedAt: publishedAtFor(input.visibility, null, now),
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<PostDoc>("posts").insertOne(doc as PostDoc & { _id: ObjectId });
  await syncTags(db, input.tags);
  return doc;
}

export async function updatePost(
  slug: string,
  input: {
    title: string;
    blocks: unknown[];
    tags: string[];
    visibility: Visibility;
  }
): Promise<PostDoc | null> {
  const db = await getDb();
  const existing = await db.collection<PostDoc>("posts").findOne({ slug });
  if (!existing) return null;

  const now = new Date();
  const publishedAt = publishedAtFor(
    input.visibility,
    existing.publishedAt ?? null,
    now
  );

  await db.collection<PostDoc>("posts").updateOne(
    { slug },
    {
      $set: {
        title: input.title,
        blocks: input.blocks as PostDoc["blocks"],
        plainText: blocksToPlainText(input.blocks),
        tags: input.tags,
        visibility: input.visibility,
        publishedAt,
        updatedAt: now,
      },
    }
  );
  await syncTags(db, input.tags);
  return {
    ...existing,
    ...input,
    publishedAt,
    updatedAt: now,
  } as PostDoc;
}

/**
 * 按 slug 读取。
 * includeHidden=false（默认）：只允许 public，私有/草稿返回 null（当作不存在）。
 * includeHidden=true：登录后用，可读任意状态。
 */
export async function getPostBySlug(
  slug: string,
  includeHidden = false
): Promise<PostDoc | null> {
  const db = await getDb();
  const filter: Record<string, unknown> = { slug };
  if (!includeHidden) filter.visibility = "public";
  return db.collection<PostDoc>("posts").findOne(filter);
}

export async function listPosts(opts: {
  visibility?: Visibility;
  includeHidden?: boolean;
  tag?: string;
  page?: number;
  limit?: number;
  query?: string;
} = {}): Promise<{ items: PostDoc[]; total: number }> {
  const db = await getDb();
  const filter: Record<string, unknown> = {};

  // 访客默认只看 public；登录后 includeHidden 则不加可见性限制
  if (opts.visibility) {
    filter.visibility = opts.visibility;
  } else if (!opts.includeHidden) {
    filter.visibility = "public";
  }

  if (opts.tag) filter.tags = opts.tag;

  if (opts.query) {
    const q = opts.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(q, "i");
    filter.$or = [{ title: re }, { plainText: re }, { tags: re }];
  }

  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.max(1, opts.limit ?? 10);
  const collection = db.collection<PostDoc>("posts");
  const total = await collection.countDocuments(filter);
  // 只按一条时间线排序：定稿文章用 publishedAt，草稿用 createdAt（草稿没有定稿时间）
  // 否则草稿的 publishedAt 为 null，会被排到列表最底部，位置和显示日期对不上
  const items = await collection
    .aggregate<PostDoc>([
      { $match: filter },
      { $addFields: { sortDate: { $ifNull: ["$publishedAt", "$createdAt"] } } },
      { $sort: { sortDate: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $unset: "sortDate" },
    ])
    .toArray();
  return { items, total };
}

export async function deletePost(slug: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection<PostDoc>("posts").deleteOne({ slug });
  if (result.deletedCount > 0) await syncTags(db, []);
  return result.deletedCount > 0;
}

/** 保存文章后同步标签表：用到的补进表里，没人再引用的删掉 */
async function syncTags(
  db: Awaited<ReturnType<typeof getDb>>,
  usedTags: string[]
) {
  for (const name of usedTags) {
    await db.collection("tags").updateOne(
      { name },
      { $setOnInsert: { name, createdAt: new Date() } },
      { upsert: true }
    );
  }
  const all = await db.collection("tags").find({}).toArray();
  for (const doc of all) {
    const name = doc.name as string;
    if (usedTags.includes(name)) continue;
    const used = await db
      .collection<PostDoc>("posts")
      .countDocuments({ tags: name });
    if (used === 0) await db.collection("tags").deleteOne({ name });
  }
}

export async function listTags(): Promise<string[]> {
  const db = await getDb();
  const docs = await db.collection("tags").find({}).sort({ name: 1 }).toArray();
  return docs.map((d) => d.name as string);
}
