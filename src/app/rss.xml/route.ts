// RSS 2.0：只输出 public 文章，最多 20 篇
import { currentLocale } from "@/lib/i18n";
import { listPosts } from "@/lib/posts";
import { getSettings } from "@/lib/settings";
import { siteOrigin } from "@/lib/site-url";
import { xmlEscape } from "@/lib/xml";

export const dynamic = "force-dynamic";

export async function GET() {
  const [{ items }, settings] = await Promise.all([
    listPosts({ limit: 20 }),
    getSettings(),
  ]);
  const origin = siteOrigin();
  const title = settings.seoTitle || settings.siteName;
  const description = settings.seoDescription || settings.description;

  const itemsXml = items
    .map((post) => {
      const link = `${origin}/posts/${post.slug}`;
      const date = post.publishedAt ?? post.createdAt;
      const summary = post.plainText.slice(0, 200);
      return `    <item>
      <title>${xmlEscape(post.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <description>${xmlEscape(summary)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(title)}</title>
    <link>${xmlEscape(origin)}</link>
    <description>${xmlEscape(description)}</description>
    <language>${currentLocale()}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}
