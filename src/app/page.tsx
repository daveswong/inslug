// 首页：站点信息 + 搜索 + 标签 + 文章时间线（全部来自数据库）
import type { Metadata } from "next";
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

/**
 * 首页的规范地址。
 *
 * 要跟实际 URL 完全一致（分页和标签都用查询参数），否则搜索引擎会以为
 * 分页页、标签页都是首页的重复，权重就分散了。
 * 分页链接和这个函数共用一份逻辑，不会写岔。
 */
function canonicalHref(page: number, tag?: string): string {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/**
 * 首页的元信息。
 *
 * 规范地址要区分三种情况，不然搜索引擎会以为分页页和标签页都是首页的重复：
 * - 第 1 页且没标签：/ 就是它自己
 * - 第 N 页：/?page=N
 * - 带标签：/?tag=xxx（翻页时 /?tag=xxx&page=N）
 */
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const t = await getT();
  const { page: pageParam, tag } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const url = canonicalHref(page, tag);

  return {
    // 带标签时给「标签：xxx」，不带时**整个 title 字段都不写**，
    // 让它继承 layout 里的标题（没设置标题时才用站点名）。
    //
    // 别写成 title: undefined——显式给 undefined 会被当成「本页明确不要标题」，
    // 把继承来的 default 覆盖掉，结果 <title> 和 og:title 整个消失，
    // 浏览器标签页只剩网址。
    ...(tag ? { title: t("标签：{tag}", { tag }) } : {}),
    alternates: { canonical: url },
    openGraph: { url },
  };
}

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

  // 和 canonical 用同一份逻辑，链接和搜索引擎看到的地址永远一致
  const pageHref = (target: number) => canonicalHref(target, tag);

  const socialLinks = settings.social.filter((link) => link.title && link.url);

  return (
    <main className="site mx-auto">
      <header className="site-head">
        <h1 className="site-title">
          <a href="/">{settings.siteName}</a>
        </h1>
        {settings.description && <p className="site-desc">{settings.description}</p>}
      </header>

      <section className="section">
        <form className="search-form d-flex" action="/search" method="get">
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
          <div className="tag-list d-flex flex-wrap">
            {tags.map((name) => (
              <a href={canonicalHref(1, name)} key={name}>
                {name}
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">{tag ? t("标签：{tag}", { tag }) : t("更新")}</h2>
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
          <ul className="post-list list-unstyled m-0 p-0">
            {items.map((post) => (
              <li className="post-item d-flex align-items-baseline" key={post.slug}>
                <time className="post-date flex-shrink-0" dateTime={formatDate(postDisplayDate(post))}>
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
          <nav className="pager d-flex align-items-baseline">
            {page > 1 ? <a href={pageHref(page - 1)}>{t("上一页")}</a> : <span className="pager-off">{t("上一页")}</span>}
            <span className="pager-index">
              {page} / {totalPages}
            </span>
            {page < totalPages ? <a href={pageHref(page + 1)}>{t("下一页")}</a> : <span className="pager-off">{t("下一页")}</span>}
          </nav>
        )}
      </section>

      {socialLinks.length > 0 && (
        <nav className="site-links d-flex flex-wrap">
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
