// 首页：站点信息 + 搜索 + 标签 + 文章时间线（全部来自数据库）
import { listPosts, listTags } from "@/lib/posts";
import { getSettings } from "@/lib/settings";
import { isLoggedIn } from "@/lib/auth";
import SiteFooter from "@/components/SiteFooter";
import InstallHint from "@/components/install-hint";
import { isDbConfigured } from "@/lib/mongodb";
import { formatDate, postDisplayDate, postFlags } from "@/lib/post-utils";
import { getT } from "@/lib/i18n";

// new 标签依赖当前时间，文章也随时会变，必须动态渲染
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ page?: string; tag?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const t = await getT();
  const { page: pageParam, tag } = await searchParams;
  const settings = await getSettings();
  const loggedIn = await isLoggedIn();
  const page = Math.max(1, Number(pageParam) || 1);

  // 数据库还没配好（全新部署的第一步）时，给安装入口而不是 500
  if (!(await isDbConfigured())) return <InstallHint />;

  // 访客只看 public；登录后 private / draft 也出现在同一条时间线里，靠标题前的标签区分
  const [{ items, total }, tags] = await Promise.all([
    listPosts({
      page,
      limit: settings.postsPerPage,
      tag,
      includeHidden: loggedIn,
    }),
    listTags(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / settings.postsPerPage));

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const socialLinks = settings.social.filter((link) => link.title && link.url);

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">
          <a href="/">{settings.siteName}</a>
        </h1>
        {settings.description && <p className="site-desc">{settings.description}</p>}
      </header>

      <section className="section">
        <form className="search-form" action="/search" method="get">
          <input
            className="search-input"
            type="search"
            name="q"
            placeholder={t("搜索文章")}
            aria-label={t("搜索文章")}
          />
          <button className="btn btn-outline-light btn-plain" type="submit">
            
            {t("搜索")}
          </button>
        </form>
        {tags.length > 0 && (
          <div className="tag-list">
            {tags.map((name) => (
              <a href={`/?tag=${encodeURIComponent(name)}`} key={name}>
                {name}
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">{tag ? `标签：${tag}` : t("更新")}</h2>
        {items.length === 0 ? (
          <p className="notice">
            {tag ? t("这个标签下还没有文章。") : t("还没有文章。")}
            {tag && (
              <>
                {" "}
                <a href="/">{t("查看全部")}</a>
              </>
            )}
          </p>
        ) : (
          <ul className="post-list">
            {items.map((post) => (
              <li className="post-item" key={post.slug}>
                <time className="post-date" dateTime={formatDate(postDisplayDate(post))}>
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
        )}
        {totalPages > 1 && (
          <nav className="pager">
            {page > 1 ? <a href={pageHref(page - 1)}>{t("上一页")}</a> : <span className="pager-off">{t("上一页")}</span>}
            <span className="pager-index">
              {page} / {totalPages}
            </span>
            {page < totalPages ? <a href={pageHref(page + 1)}>{t("下一页")}</a> : <span className="pager-off">{t("下一页")}</span>}
          </nav>
        )}
      </section>

      {socialLinks.length > 0 && (
        <nav className="site-links">
          {socialLinks.map((link) => (
            <a href={link.url} key={`${link.title}-${link.url}`} rel="noopener noreferrer">
              {link.title}
            </a>
          ))}
        </nav>
      )}

      <SiteFooter />
    </main>
  );
}
