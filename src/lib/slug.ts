import { randomBytes } from "node:crypto";
import { pinyin } from "pinyin-pro";

/**
 * 把文本切成 slug 词：连续英文数字原样保留（小写），连续汉字转无声调拼音，
 * 其余符号自然丢弃。limit 只用于自动生成时限段数，手填 slug 不截断。
 * 按「连续块」切，避免把 Hello 拆成 h-e-l-l-o。
 */
function toSlugWords(text: string, limit?: number): string[] {
  const chunks = text.match(/[a-zA-Z0-9]+|[\u4e00-\u9fff]+/g) ?? [];
  const words: string[] = [];

  for (const chunk of chunks) {
    if (/^[a-zA-Z0-9]+$/.test(chunk)) {
      words.push(chunk.toLowerCase());
    } else {
      words.push(...pinyin(chunk, { toneType: "none", type: "array" }));
    }
    if (limit && words.length >= limit) break;
  }
  return words;
}

function joinSlug(words: string[]): string {
  return words
    .join("-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 由标题自动生成可读 slug：取前 4 段，末尾加 6 位随机十六进制防重名。
 *
 * 例：「为什么写一个只给自己用的博客程序」→
 *     wei-shen-me-xie-a1b2c3
 *
 * 只在新建且用户没填自定义地址时使用；编辑标题不会自动改 slug。
 */
export function makeSlug(title: string): string {
  const base = joinSlug(toSlugWords(title, 4));
  const suffix = randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : `post-${suffix}`;
}

/**
 * 规范化用户手填的 slug：英文原样保留（这正是要保留 "slug" 这类词的地方），
 * 中文兜底转拼音，不加随机后缀、不截段数。返回空串表示没填，调用方据此
 * 走自动生成或保持原样。
 */
export function normalizeCustomSlug(input: string): string {
  return joinSlug(toSlugWords(input)).slice(0, 100).replace(/-$/, "");
}
