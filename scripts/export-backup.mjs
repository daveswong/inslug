// 整站备份：导出文章 JSON + 每篇 Markdown + 站点设置 / 标签。
// 刻意不导出 auth / passkeys / pending_changes —— 那是凭据，不该出现在备份文件里。
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MongoClient } from "mongodb";
import { resolveDb } from "./_db.mjs";

const { uri, dbName } = resolveDb();

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const [posts, tags, settings] = await Promise.all([
  db.collection("posts").find({}).sort({ createdAt: 1 }).toArray(),
  db.collection("tags").find({}).sort({ name: 1 }).toArray(),
  db.collection("settings").findOne({ _id: "site" }),
]);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
const outDir = join("backups", stamp);
mkdirSync(join(outDir, "posts"), { recursive: true });

writeFileSync(join(outDir, "posts.json"), JSON.stringify(posts, null, 2));
writeFileSync(join(outDir, "tags.json"), JSON.stringify(tags, null, 2));
writeFileSync(join(outDir, "settings.json"), JSON.stringify(settings ?? {}, null, 2));

/** BlockNote 块 → 粗略 Markdown。目标是能读，不是 1:1 还原富文本。 */
function blockText(block) {
  if (typeof block.content === "string") return block.content;
  if (!Array.isArray(block.content)) return "";
  return block.content
    .map((c) => {
      if (!c || typeof c !== "object") return "";
      let text = String(c.text ?? "");
      if (c.styles) {
        if (c.styles.bold) text = `**${text}**`;
        if (c.styles.italic) text = `*${text}*`;
        if (c.styles.code) text = `\`${text}\``;
      }
      return text;
    })
    .join("");
}

function blocksToMarkdown(blocks, depth = 0) {
  const lines = [];
  for (const block of blocks ?? []) {
    const text = blockText(block);
    const type = block.type ?? "paragraph";
    if (type === "heading") {
      const level = Math.min(6, Math.max(1, Number(block.props?.level ?? 1)));
      lines.push(`${"#".repeat(level)} ${text}`);
    } else if (type === "bulletListItem") {
      lines.push(`${"  ".repeat(depth)}- ${text}`);
    } else if (type === "numberedListItem") {
      lines.push(`${"  ".repeat(depth)}1. ${text}`);
    } else if (type === "codeBlock") {
      lines.push("```", text, "```");
    } else if (type === "quote") {
      lines.push(`> ${text}`);
    } else if (type === "divider") {
      lines.push("---");
    } else if (type === "image") {
      lines.push(`![${block.props?.caption ?? ""}](${block.props?.url ?? ""})`);
    } else if (type === "file") {
      lines.push(`[📎 ${block.props?.name ?? "文件"}](${block.props?.url ?? ""})`);
    } else if (type === "audio") {
      lines.push(`[🔊 ${block.props?.name ?? "音频"}](${block.props?.url ?? ""})`);
    } else if (type === "video") {
      lines.push(`[🎬 ${block.props?.name ?? "视频"}](${block.props?.url ?? ""})`);
    } else {
      lines.push(text);
    }
    if (Array.isArray(block.children) && block.children.length) {
      lines.push(...blocksToMarkdown(block.children, depth + 1));
    }
  }
  return lines.join("\n");
}

for (const post of posts) {
  const front = [
    "---",
    `title: ${JSON.stringify(post.title)}`,
    `slug: ${post.slug}`,
    `visibility: ${post.visibility}`,
    `tags: ${JSON.stringify(post.tags ?? [])}`,
    `date: ${(post.publishedAt ?? post.createdAt).toISOString()}`,
    "---",
    "",
  ].join("\n");

  const file = `${post.slug}.md`.replace(/[^a-zA-Z0-9._-]/g, "-");
  // 文件/音视频都在正文块里，blocksToMarkdown 会一并转出来
  writeFileSync(
    join(outDir, "posts", file),
    front + blocksToMarkdown(post.blocks) + "\n"
  );
}

await client.close();
console.log(`已备份 ${posts.length} 篇文章到 ${outDir}`);
console.log("凭据集合（auth / passkeys / pending_changes）未导出。");
