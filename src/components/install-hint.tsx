// 数据库还没配好时的提示页。
//
// 全新部署的第一件事就是填数据库地址，那之前首页、文章页都得能打开，
// 给出「去安装向导」的入口，而不是甩一个 500 错误页。
import SiteFooter from "@/components/SiteFooter";
import { getT } from "@/lib/i18n";

export default async function InstallHint() {
  const t = await getT();
  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{t("站点还没配置好")}</h1>
        <p className="site-desc">
          {t("数据库连不上，所以没有内容可以显示。")}
        </p>
      </header>

      <section className="section">
        <p className="notice">
          <a href="/setup">{t("去安装向导")}</a>
        </p>
        <p className="notice">
          {t("第一步填数据库地址就行，填完刷新页面。")}
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
