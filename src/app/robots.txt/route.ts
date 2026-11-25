import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    // 写作、设置、确认页不该被索引
    "Disallow: /write",
    "Disallow: /settings",
    "Disallow: /setup",
    "Disallow: /confirm/",
    "",
    `Sitemap: ${siteOrigin()}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
