import type { Metadata } from "next";
import { I18nProvider } from "@/components/i18n-provider";
import WriteFab from "@/components/WriteFab";
import { isLoggedIn } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
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
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  // 分享卡片图：设置页填了就用填的，没填用仓库里的渐变彩色图标
  const images = s.ogImage
    ? [s.ogImage]
    : [new URL("/icon-color.png", siteUrl).toString()];

  // 设置页填了就用填的，没填用仓库里的默认图标：
  // 白底黑字做标签栏图标，黑底白字给 iOS，渐变彩色留给分享卡片
  const faviconIsPng = /\.png(\?|$)/i.test(s.favicon);
  const icons = s.favicon
    ? {
        icon: [{ url: s.favicon }],
        // iOS 只认 PNG/JPEG 当主屏图标；其它格式回退到默认的黑底白字
        apple: [
          {
            url: faviconIsPng ? s.favicon : "/apple-touch-icon.png",
            sizes: "180x180",
          },
        ],
      }
    : {
        icon: [
          { url: "/favicon.ico", sizes: "16x16 24x24 32x32 48x48 64x64 128x128 256x256" },
          { url: "/icon.svg", type: "image/svg+xml" },
        ],
        apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
      };

  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s · ${s.siteName}` },
    description,
    keywords,
    authors: s.author ? [{ name: s.author }] : undefined,
    icons,
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
  const [loggedIn, i18n] = await Promise.all([isLoggedIn(), getI18n()]);

  return (
    <html lang={i18n.locale}>
      <head>
        {/* 手动外观要在首次绘制前生效，避免深浅色闪一下 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('inslug-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <I18nProvider dict={i18n.dict}>
          <WriteFab visible={loggedIn} />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
