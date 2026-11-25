import { randomBytes } from "node:crypto";
import { pinyin } from "pinyin-pro";

/**
 * 由标题生成可读的 slug：中文转无声调拼音，英文/数字原样保留，
 * 末尾加 6 位随机十六进制防重名。
 *
 * 例：「为什么写一个只给自己用的博客程序」→
 *     wei-shen-me-xie-a1b2c3
 *
 * 只在新建文章时生成；编辑标题不会改 slug，已发布的旧文章地址也不受影响。
 */

export function makeSlug(title: string): string {
  // 按「连续英文数字」与「连续汉字」切块，避免把 Hello 拆成 h-e-l-l-o
  const chunks = title.match(/[a-zA-Z0-9]+|[\u4e00-\u9fff]+/g) ?? [];
  const words: string[] = [];

  for (const chunk of chunks) {
    if (/^[a-zA-Z0-9]+$/.test(chunk)) {
      words.push(chunk.toLowerCase());
    } else {
      words.push(...pinyin(chunk, { toneType: "none", type: "array" }));
    }
    if (words.length >= 4) break;
  }

  const suffix = randomBytes(3).toString("hex");
  const base = words
    .slice(0, 4)
    .join("-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `${base}-${suffix}` : `post-${suffix}`;
}
