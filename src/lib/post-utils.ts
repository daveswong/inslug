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
 *
 * 置顶不在这里标记：位置本身就是信号，列表里加个标签反而画蛇添足。
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

/**
 * 统一显示成 YYYY-MM-DD。
 * 固定按东八区格式化：Vercel 运行时是 UTC，直接用 getFullYear/getMonth
 * 会让 UTC 00:00–07:59 发布的文章显示成前一天。
 */
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDate(date: Date): string {
  const parts = DATE_FMT.formatToParts(new Date(date));
  const pick = (type: "year" | "month" | "day") =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
