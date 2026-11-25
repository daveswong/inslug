// 写作页：新建（无参数）或编辑（?slug=xxx），内容与标签都从数据库读
import SiteFooter from "@/components/SiteFooter";
import { getPostBySlug, listTags } from "@/lib/posts";
import WriteClient from "./write-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ slug?: string }>;
};

export default async function WritePage({ searchParams }: Props) {
  const { slug } = await searchParams;
  // 这个路由只对登录者开放，取文章时一并包含私有和草稿
  const [post, tags] = await Promise.all([
    slug ? getPostBySlug(slug, true) : Promise.resolve(null),
    listTags(),
  ]);

  return (
    <main className="site write-page">
      <WriteClient
        slug={post?.slug ?? null}
        initialTitle={post?.title ?? ""}
        initialTags={post?.tags ?? []}
        initialBlocks={post?.blocks ?? []}
        initialVisibility={post?.visibility ?? "draft"}
        availableTags={tags}
      />
      <SiteFooter />
    </main>
  );
}
