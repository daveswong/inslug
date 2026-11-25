// 自定义 404：和站内其他页面同一套极简排版，不用 Next 的英文默认页
import SiteFooter from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">页面不存在</h1>
        <p className="site-desc">
          地址可能写错了，文章也许还没发布、已经删掉，或者换了地址。
        </p>
      </header>

      <section className="section">
        <p>
          <a href="/">返回首页</a>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
