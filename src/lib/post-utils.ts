import type { Visibility } from "./types";

/** 标题前显示的极简英文状态标签 */
export type PostFlag = "new" | "private" | "draft";

/** 发布日期距今不超过 6 个月，则显示 new 标记 */
export function isNew(publishedAt: Date | null, now: Date = new Date()): boolean {
  if (!publishedAt) return false;
  const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
  const diff = now.getTime() - publishedAt.getTime();
  return diff >= 0 && diff <= sixMonthsMs;
}

/**
 * 一篇文章在列表中需要显示哪些标签：
 * - draft：未写完自己看（登录后可见）
 * - private：写完但访客看不到（登录后可见）
 * - new：公开且发布时间不超过 6 个月
 * 三者互斥，一篇文章最多一个标签。
 */
export function postFlags(
  post: { visibility: Visibility; publishedAt: Date | null },
  now: Date = new Date()
): PostFlag[] {
  if (post.visibility === "draft") return ["draft"];
  if (post.visibility === "private") return ["private"];
  return isNew(post.publishedAt, now) ? ["new"] : [];
}

/** 列表显示日期：公开/私有用定稿时间，草稿用创建时间 */
export function postDisplayDate(post: {
  publishedAt: Date | null;
  createdAt: Date;
}): Date {
  return post.publishedAt ?? post.createdAt;
}

/** 统一显示成 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const d = new Date(date);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
