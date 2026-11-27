// 文章详情页：按 slug 从数据库读取；非 public 的文章目前一律当不存在（登录鉴权接入后再放开）
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostBody from "@/components/PostBody";
import AttachmentList from "@/components/AttachmentList";
import SiteFooter from "@/components/SiteFooter";
import InstallHint from "@/components/install-hint";
import { getPostBySlug } from "@/lib/posts";
import { isDbConfigured } from "@/lib/mongodb";
import { getStorageProvider } from "@/lib/storage";
import { isLoggedIn } from "@/lib/auth";
import { formatDate, postDisplayDate } from "@/lib/post-utils";
import type { PostDoc } from "@/lib/types";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getT();
  const { slug } = await params;
  // 与页面一致：私有/草稿对访客当作不存在，别把标题漏进 meta
  // 数据库还没配好时（新部署）也别报错，标题给个默认的
  let post: PostDoc | null = null;
  try {
    post = await getPostBySlug(slug, await isLoggedIn());
  } catch {
    post = null;
  }
  if (!post) return { title: t("文章不存在") };

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
  const t = await getT();
  const { slug } = await params;
  // 登录后私有/草稿也能打开；访客只认 public
  const loggedIn = await isLoggedIn();
  // 数据库还没配好时给安装入口
  if (!(await isDbConfigured())) return <InstallHint />;
  const post = await getPostBySlug(slug, loggedIn);
  if (!post) notFound();

  const date = formatDate(postDisplayDate(post));
  // 附件下载链接要按存储方案拼（强制下载参数各家不一样）
  const storageProvider = await getStorageProvider();

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
              <a href="/">{t("返回首页")}</a>
              {post.visibility !== "public" && (
                <span className="post-state">{post.visibility}</span>
              )}
              {loggedIn && <a href={`/write?slug=${post.slug}`}>{t("编辑")}</a>}
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

        <AttachmentList
          attachments={post.attachments ?? []}
          provider={storageProvider}
        />
      </article>

      <SiteFooter />
    </main>
  );
}
