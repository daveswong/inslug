// 写作页：新建（无参数）或编辑（?slug=xxx），内容与标签都从数据库读
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { isLoggedIn } from "@/lib/auth";
import { getPostBySlug, listTags } from "@/lib/posts";
import { getSettings } from "@/lib/settings";
import { getStorageProvider } from "@/lib/storage";
import { siteOrigin } from "@/lib/site-url";
import WriteClient from "./write-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ slug?: string }>;
};

export default async function WritePage({ searchParams }: Props) {
  const { slug } = await searchParams;

  // proxy.ts 只粗筛 cookie，会话版本失效（换过验证器）的旧 cookie 要在这里挡掉
  if (!(await isLoggedIn())) {
    const next = slug ? `/write?slug=${encodeURIComponent(slug)}` : "/write";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  // 这个路由只对登录者开放，取文章时一并包含私有和草稿
  const [post, tags, storageProvider, settings] = await Promise.all([
    slug ? getPostBySlug(slug, true) : Promise.resolve(null),
    listTags({ includeHidden: true }),
    getStorageProvider(),
    getSettings(),
  ]);

  return (
    <main className="site write-page mx-auto">
      <WriteClient
        slug={post?.slug ?? null}
        initialTitle={post?.title ?? ""}
        initialTags={post?.tags ?? []}
        initialBlocks={post?.blocks ?? []}
        initialVisibility={post?.visibility ?? "draft"}
        initialPinned={post?.pinned ?? false}
        availableTags={tags}
        storageProvider={storageProvider}
        siteOrigin={siteOrigin()}
        autosaveMinutes={settings.autosaveMinutes}
      />
      <SiteFooter />
    </main>
  );
}
