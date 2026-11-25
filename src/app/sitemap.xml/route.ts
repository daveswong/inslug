// 站点地图：首页 + 搜索 + 全部 public 文章
import { listPosts } from "@/lib/posts";
import { isDbConfigured } from "@/lib/mongodb";
import { siteOrigin } from "@/lib/site-url";
import { xmlEscape } from "@/lib/xml";

export const dynamic = "force-dynamic";

export async function GET() {
  // 数据库还没配好时（新部署）返回 503，而不是 500
  if (!(await isDbConfigured())) {
    return new Response("Site is not configured yet.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const { items } = await listPosts({ limit: 1000 });
  const origin = siteOrigin();

  const urls = [
    { loc: origin, lastmod: "" },
    { loc: `${origin}/search`, lastmod: "" },
    ...items.map((post) => ({
      loc: `${origin}/posts/${post.slug}`,
      lastmod: (post.updatedAt ?? post.createdAt).toISOString().slice(0, 10),
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
