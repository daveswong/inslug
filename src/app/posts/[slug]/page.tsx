// 文章详情页：按 slug 从数据库读取；非 public 的文章目前一律当不存在（登录鉴权接入后再放开）
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostBody from "@/components/PostBody";
import SiteFooter from "@/components/SiteFooter";
import { getPostBySlug } from "@/lib/posts";
import { isLoggedIn } from "@/lib/auth";
import { formatDate, postDisplayDate } from "@/lib/post-utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // 与页面一致：私有/草稿对访客当作不存在，别把标题漏进 meta
  const post = await getPostBySlug(slug, await isLoggedIn());
  if (!post) return { title: "文章不存在" };

  const excerpt = post.plainText.replace(/\s+/g, " ").trim();
  const description =
    excerpt.length > 120 ? `${excerpt.slice(0, 120)}…` : excerpt;
  const url = `/posts/${post.slug}`;

  return {
    title: post.title,
    description,
    keywords: post.tags.length > 0 ? post.tags : undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
      publishedTime: post.publishedAt?.toISOString(),
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  // 登录后私有/草稿也能打开；访客只认 public
  const loggedIn = await isLoggedIn();
  const post = await getPostBySlug(slug, loggedIn);
  if (!post) notFound();

  const date = formatDate(postDisplayDate(post));

  return (
    <main className="site">
      <article>
        <header className="post-head">
          <h1 className="post-head-title">{post.title}</h1>
          <div className="post-meta-line">
            <time className="post-date" dateTime={date}>
              {date}
            </time>
            <span className="post-meta-links">
              <a href="/">返回首页</a>
              {post.visibility !== "public" && (
                <span className="post-state">{post.visibility}</span>
              )}
              {loggedIn && <a href={`/write?slug=${post.slug}`}>编辑</a>}
            </span>
          </div>
          {post.tags.length > 0 && (
            <div className="post-head-tags">
              {post.tags.map((tag) => (
                <a href={`/?tag=${encodeURIComponent(tag)}`} key={tag}>
                  {`#${tag}`}
                </a>
              ))}
            </div>
          )}
        </header>

        <PostBody blocks={post.blocks} />
      </article>

      <SiteFooter />
    </main>
  );
}
