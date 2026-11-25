// 演示数据：为 inslug 演示站灌入几篇与项目本身相关的文章
// 用法：node scripts/_seed-test.mjs（重复执行会先清空旧的演示数据）
import { MongoClient } from "mongodb";
import { resolveDb } from "./_db.mjs";

const { uri, dbName } = resolveDb();
const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const text = (t) => ({ type: "text", text: t, styles: {} });
const p = (t) => ({ type: "paragraph", content: [text(t)], children: [] });
const h = (level, t) => ({
  type: "heading",
  props: { level },
  content: [text(t)],
  children: [],
});
const ul = (items) => ({
  type: "bulletListItem",
  content: [text(items[0])],
  children: items.slice(1).map((it) => ({
    type: "bulletListItem",
    content: [text(it)],
    children: [],
  })),
});
const ol = (items) => ({
  type: "numberedListItem",
  content: [text(items[0])],
  children: items.slice(1).map((it) => ({
    type: "numberedListItem",
    content: [text(it)],
    children: [],
  })),
});
const quote = (t) => ({ type: "quote", content: [text(t)], children: [] });
const code = (t) => ({ type: "codeBlock", props: {}, content: [text(t)], children: [] });
const divider = () => ({ type: "divider", children: [] });

/** 把块数组压成纯文本，供搜索用 */
const plain = (blocks) =>
  blocks
    .map((b) => (b.content ?? []).map((c) => c.text ?? "").join("") + (b.children?.map((c) => (c.content ?? []).map((x) => x.text ?? "").join("")).join(" ") ?? ""))
    .join(" ");

const posts = [
  {
    slug: "why-inslug",
    title: "为什么写一个只给自己用的博客程序",
    tags: ["编程", "工具"],
    visibility: "public",
    publishedAt: new Date("2026-11-20T13:00:00Z"),
    createdAt: new Date("2026-11-20T13:00:00Z"),
    blocks: [
      p("现在的博客系统大多在解决「平台」的问题：多用户、评论、主题市场、插件生态。我要的只是一个安静的地方，把编程和电路上踩过的坑记下来。"),
      h(2, "几条硬性约束"),
      ul([
        "文章只按时间排列，不做分类分区",
        "列表只有日期和标题，不要摘要、不要封面图",
        "页面上不留任何抢走注意力的装饰",
      ]),
      h(2, "于是有了 inslug"),
      p("Next.js 写页面，MongoDB 存文章，BlockNote 做所见即所得编辑器。单用户，登录只保护「写文章」和「设置」两件事，其余全部公开可读。"),
      p("所有文章的内容就是一棵块树，和编辑器里看到的完全一致，不用再维护一套 Markdown 转换。"),
      quote("博客首先是写给自己的，其次才是写给别人看的。"),
      p("所以这个程序不追求功能齐全，只追求写起来没有阻力、读起来没有干扰。"),
    ],
  },
  {
    slug: "stack-notes",
    title: "技术选型笔记：Next.js、MongoDB 与 BlockNote",
    tags: ["编程"],
    visibility: "public",
    publishedAt: new Date("2026-09-10T09:30:00Z"),
    createdAt: new Date("2026-09-10T09:30:00Z"),
    blocks: [
      p("记录一下这套组合选下来的理由，以及各自承担的边界。"),
      h(2, "页面与渲染"),
      p("用 App Router，首页和详情页都按需动态渲染：文章随时会改，状态标签又依赖当前时间，静态预渲染反而会留下过期结果。"),
      h(2, "一篇文章就是一条文档"),
      p("正文直接用编辑器产出的块数组落库，同时保存一份纯文本用于搜索，避免查询时反复解析块结构。"),
      code(
        [
          "type PostDoc = {",
          "  slug: string;",
          "  title: string;",
          "  blocks: Block[];",
          "  plainText: string;",
          "  tags: string[];",
          "  visibility: \"public\" | \"private\" | \"draft\";",
          "  publishedAt: Date | null;",
          "};",
        ].join("\n")
      ),
      h(3, "标签不用单独维护"),
      p("标签只存在两个地方：文章上的引用，和一份标签表。保存文章时顺手清理没有任何引用的标签，界面上就不会出现空标签。"),
      divider(),
      p("整套体系里没有后台管理界面，写作页就是唯一的管理入口。"),
    ],
  },
  {
    slug: "visibility",
    title: "公开、私有、草稿：三态可见性怎么用",
    tags: ["工具"],
    visibility: "public",
    publishedAt: new Date("2026-05-01T15:00:00Z"),
    createdAt: new Date("2026-05-01T15:00:00Z"),
    blocks: [
      p("写东西的节奏不总是「写完了就发」。所以每篇文章有一个可见性状态，在写作页底部选择。"),
      ol([
        "公开：任何人访问都能看到，出现在首页时间线里",
        "私有：只有登录后的自己能看到，适合放调试记录和私人笔记",
        "草稿：还没写完，同样只有自己能看到，列表里会标上 draft",
      ]),
      h(2, "访客看到的世界"),
      p("未登录访问时，列表和详情都只包含公开文章；私有和草稿直接访问会当作不存在，不会返回任何内容。"),
      p("登录之后，三态文章混在同一条时间线里，靠标题前的英文小标签区分，不需要额外的管理列表。"),
      quote("状态是给作者看的，不是给读者看的。"),
    ],
  },
  {
    slug: "private-notes",
    title: "私人笔记：手头这块板子的调试记录",
    blocks: [
      p("内层板还在冒烟测试，记录先放这里，等稳定了再整理成公开文章。"),
      ul(["上电时序要再确认一遍", "去耦电容位置待调整"]),
    ],
    tags: ["电路"],
    visibility: "private",
    publishedAt: new Date("2026-11-22T11:00:00Z"),
    createdAt: new Date("2026-11-22T11:00:00Z"),
  },
  {
    slug: "draft-upload",
    title: "还没写完：图片上传与 Vercel Blob",
    blocks: [
      p("计划把编辑器里的图片上传接到 Vercel Blob，文章只存 URL。"),
      p("这里留一个草稿，用来验证草稿不会出现在访客的列表里。"),
    ],
    tags: [],
    visibility: "draft",
    publishedAt: null,
    createdAt: new Date("2026-11-23T16:00:00Z"),
  },
].map((post) => ({
  ...post,
  plainText: plain(post.blocks),
  updatedAt: post.publishedAt ?? post.createdAt,
}));

// 清掉旧的演示数据，避免重复
await db.collection("posts").deleteMany({ slug: { $in: posts.map((p) => p.slug) } });
await db.collection("posts").insertMany(posts);

await db.collection("tags").deleteMany({});
await db.collection("tags").insertMany(
  [...new Set(posts.flatMap((p) => p.tags))].map((name) => ({ name, createdAt: new Date() }))
);

await db.collection("settings").updateOne(
  { _id: "site" },
  {
    $set: {
      _id: "site",
      siteName: "inslug",
      description: "一个人写的博客程序，记录编程与电路上的折腾。",
      author: "",
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
      social: {},
      favicon: "",
      ogImage: "",
      footerText: "",
      postsPerPage: 5,
      updatedAt: new Date(),
    },
  },
  { upsert: true }
);

console.log(`演示数据就绪：${posts.length} 篇`);
await client.close();
