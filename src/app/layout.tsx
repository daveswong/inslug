import type { Metadata } from "next";
import WriteFab from "@/components/WriteFab";
import { isLoggedIn } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import "./globals.css";

/** 站点级元信息全部来自设置，不在代码里写死 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = s.seoTitle || s.siteName;
  const description = s.seoDescription || s.description;
  const keywords = s.seoKeywords
    ? s.seoKeywords
        .split(/[,，]/)
        .map((word) => word.trim())
        .filter(Boolean)
    : undefined;
  const images = s.ogImage ? [s.ogImage] : undefined;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s · ${s.siteName}` },
    description,
    keywords,
    authors: s.author ? [{ name: s.author }] : undefined,
    icons: s.favicon ? { icon: s.favicon } : undefined,
    openGraph: { title, description, type: "website", images },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const loggedIn = await isLoggedIn();

  return (
    <html lang="zh-CN">
      <head>
        {/* 手动外观要在首次绘制前生效，避免深浅色闪一下 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('inslog-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <WriteFab visible={loggedIn} />
        {children}
      </body>
    </html>
  );
}
