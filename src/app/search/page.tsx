// 站内搜索：标题、正文、标签都匹配（数据层 listPosts 的 query）
import { isLoggedIn } from "@/lib/auth";
import { listPosts } from "@/lib/posts";
import SiteFooter from "@/components/SiteFooter";
import InstallHint from "@/components/install-hint";
import { isDbConfigured } from "@/lib/mongodb";
import { formatDate, postDisplayDate, postFlags } from "@/lib/post-utils";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 50;

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const t = await getT();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const loggedIn = await isLoggedIn();
  // 数据库还没配好时给安装入口
  if (!(await isDbConfigured())) return <InstallHint />;
  const { items, total } = query
    ? await listPosts({ query, limit: MAX_RESULTS, includeHidden: loggedIn })
    : { items: [], total: 0 };

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">
          <a href="/">{t("搜索")}</a>
        </h1>
      </header>

      <section className="section">
        <form className="search-form" action="/search" method="get">
          <input
            className="search-input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("搜索文章")}
            aria-label={t("搜索文章")}
          />
          <button className="btn btn-outline-light btn-plain" type="submit">
            
            {t("搜索")}
          </button>
        </form>
      </section>

      <section className="section">
        <h2 className="section-title">
          {query ? t("“{q}” 的结果", { q: query }) : t("输入关键词")}
        </h2>
        {!query ? (
          <p className="notice">{t("搜标题、正文或标签都可以。")}</p>
        ) : items.length === 0 ? (
          <p className="notice">{t("没有匹配的文章。")}</p>
        ) : (
          <>
            <ul className="post-list">
              {items.map((post) => (
                <li className="post-item" key={post.slug}>
                  <time
                    className="post-date"
                    dateTime={formatDate(postDisplayDate(post))}
                  >
                    {formatDate(postDisplayDate(post))}
                  </time>
                  <span className="post-title">
                    <a href={`/posts/${post.slug}`}>{post.title}</a>
                    {postFlags(post).map((flag) => (
                      <span className="badge post-badge" key={flag}>
                        {flag}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            {total > MAX_RESULTS && (
              <p className="notice">{t("共")} {total}  {t("篇，只显示前")} {MAX_RESULTS}  {t("篇。")}</p>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
