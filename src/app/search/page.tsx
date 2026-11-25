// 站内搜索：标题、正文、标签都匹配（数据层 listPosts 的 query）
import { isLoggedIn } from "@/lib/auth";
import { listPosts } from "@/lib/posts";
import SiteFooter from "@/components/SiteFooter";
import { formatDate, postDisplayDate, postFlags } from "@/lib/post-utils";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 50;

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const loggedIn = await isLoggedIn();
  const { items, total } = query
    ? await listPosts({ query, limit: MAX_RESULTS, includeHidden: loggedIn })
    : { items: [], total: 0 };

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">
          <a href="/">搜索</a>
        </h1>
      </header>

      <section className="section">
        <form className="search-form" action="/search" method="get">
          <input
            className="search-input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="搜索文章"
            aria-label="搜索文章"
          />
          <button className="btn btn-outline-light btn-plain" type="submit">
            搜索
          </button>
        </form>
      </section>

      <section className="section">
        <h2 className="section-title">
          {query ? `“${query}” 的结果` : "输入关键词"}
        </h2>
        {!query ? (
          <p className="notice">搜标题、正文或标签都可以。</p>
        ) : items.length === 0 ? (
          <p className="notice">没有匹配的文章。</p>
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
              <p className="notice">共 {total} 篇，只显示前 {MAX_RESULTS} 篇。</p>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
