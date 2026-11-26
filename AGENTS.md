# AGENTS.md — inslog 项目卡

给参与本项目的 AI 助手：本文件是常驻上下文，与分组里的常驻指令同源。
改了技术栈、脚本、目录或硬性约定时，两份一起更新。
中文回复；先结论后理由；代码给整份文件；改完附「改了什么 + 怎么验证 + 有无风险」。
涉及数据模型 / 鉴权 / 路由 / 配置读写的改动先给方案再动手，小改动直接落地。
若本轮任务说明与本文件冲突，以本轮为准。最后更新：2026-11-26。

## 项目定位

单用户、单站点、纯自用的极简博客。只做「安静地写、存、传自己的内容」。
不做用户系统、密码、评论、统计、社交、推荐、独立后台、多用户、弹窗和花哨装饰 —— 别主动加。
**没有主题模板也不会有**：外观只有一套，用户明确不想让人把精力花在折腾外观上，不妥协；
别提议或添加主题切换 / 模板市场 / 外观预设。

仓库：https://github.com/daveswong/inslog.git （main）
公开部署采用 MIT，但必须保留指向源码仓库的可见链接（`src/components/SiteFooter.tsx`），
独立于站点内容与社媒，不在设置里改，不要移除或改成可配置项。

## 技术栈与命令

- Next.js 16.4.6（App Router / Turbopack）、React 19.3.1、TypeScript 5.9.3（strict）
- Node >= 20.9.0，`@/*` → `./src/*`
- MongoDB 原生驱动 7.9.1（无 ORM）
- BlockNote 0.57 + Mantine 9.8 + Bootstrap 5.3.9
- @simplewebauthn 13.3（Passkey）、jose（会话）、otpauth + qrcode（TOTP）
- pinyin-pro（slug）、@vercel/blob、@aws-sdk/client-s3、nodemailer

```bash
npm install
npm run dev        # next dev
npm run build      # next build
npm run start
npm run backup     # node scripts/export-backup.mjs
node scripts/test-connection.mjs   # 只读：ping + 列集合
node scripts/seed-demo.mjs         # 演示数据，可重复执行
npx tsc --noEmit                   # 类型检查（需先 npm install）
```

**没有 test / lint / typecheck 脚本**，别把 `npm test` 当验收。
本地首次运行：`cp config/database.example.json config/database.json` 填 uri；
`cp .env.example .env.local` 填 `AUTH_SECRET`（`openssl rand -base64 32`），
强烈建议再配 `RECOVERY_TOKEN`。

## 目录速查

| 路径 | 职责 |
|---|---|
| `src/app/` | 首页、详情、search、write（server action）、login、settings、setup（四步向导）、reset、confirm/[token]、not-found |
| `src/app/api/` | auth/{passkey,totp,recovery,logout}、setup/*、upload*（三套存储）、diag |
| `src/app/rss.xml` `sitemap.xml` `robots.txt` | 已实现的 feed / SEO 路由 |
| `src/components/` | BlockEditor、PostBody、SiteFooter、WriteFab、i18n-provider、各类设置表单组件 |
| `src/lib/mongodb.ts` | 连接、建库、降级（`getDbOrNull` / `isDbConfigured` / `inspectDatabase` / `ensureDatabase`） |
| `src/lib/posts.ts` | CRUD、搜索、分页、标签同步、可见性过滤 |
| `src/lib/types.ts` | PostDoc / SettingsDoc / Visibility / DEFAULT_SETTINGS |
| `src/lib/env-config.ts`、`env-store.ts` | `.env` 读写（文件优先于 process.env，3 秒缓存；Vercel 只读） |
| `src/lib/service-config.ts` | 服务类配置（读 `.env`，不存数据库） |
| `src/lib/i18n-core.ts` | SUPPORTED_LOCALES、字典回退、`{name}` 占位符 |
| `src/proxy.ts` | 只 matcher `/write`、`/settings`，只粗筛 cookie（Next 16 把 middleware 改名为 proxy） |
| `scripts/` | `_db.mjs`、`test-connection.mjs`、`seed-demo.mjs`、`export-backup.mjs` |
| `config/*.example.json` | 提交模板；实际 `database.json` / `locale.json` 被忽略 |
| `locales/*.json` | 界面语言包（key 是中文原文） |
| `public/` | ins 连笔字标三套图标 |

## 不可破坏的行为

1. 可见性三态 `draft` / `private` / `public`；访客只读 public，私有 / 草稿直接访问也拦截。
   RSS / sitemap 只输出 public。改动查询逻辑时先确认 `includeHidden` 默认值。
2. 首页区块顺序：站点名 → 简介 → 搜索 → 标签目录 → 更新列表（仅日期 + 标题、分页，
   无摘要 / 封面）→ 社媒（有才显示）→ 页脚。社媒是 `{title,url}[]`，站长在设置页自由增删，
   纯文字链接、不要图标；`getSettings()` 会把老的 `{github,x,email}` 对象转成数组，别删这个兼容。
2a. 设置页四组平铺（站点信息 / 外观 / 社交链接 / 安全），**一个保存按钮**，
   前端只提交改过的字段（`site-form.tsx` 的 hidden 字段）；主题和界面语言各自独立保存，不进表单。
3. 列表排序：置顶优先，其余 `sortDate = $ifNull(publishedAt, createdAt)` 倒序。
   聚合里的 `$ifNull` 兼容老文章缺 `pinned` / `publishedAt`，**别简化掉**。
4. slug 由 `makeSlug`（pinyin-pro + 随机后缀）生成，重名最多重试 5 次；已有文章 URL 必须兼容。
5. 标签未被引用的自动删除；公开标签目录只列 public 文章用过的，防草稿内容泄露。
6. 搜索匹配标题 + `plainText` + tag，正则已转义。发布距今 ≤ 6 个月显示 new。
7. 编辑器只用排版类块（不含待办 / 折叠）；**不提供对齐按钮**——`textAlignment` 只是块属性，
   旧文章带对齐的数据阅读页照常渲染，别为旧数据写迁移。正文存 `Block[]` + `plainText`；图片只存 URL。
8. 无密码登录：Passkey 为主、TOTP 为辅、`RECOVERY_TOKEN` + `/login?recovery=1` 兜底。
   更换 / 解绑验证器必须邮件二次确认（首次绑定除外）。前端不提供任何凭据配置入口。
9. `proxy.ts` 只做粗筛，真正验签在页面层 `isLoggedIn()`；proxy 固定跑 Node.js，
   但别把鉴权逻辑搬进去——验签只留 `isLoggedIn()` 一个入口。
10. 数据库未配置时首页 / 文章页降级显示安装提示、`rss.xml` 返回 503 —— 别「修」成抛 500。
11. `scripts/export-backup.mjs` 刻意不导出 `auth` / `passkeys` / `pending_changes`，别加进去。
12. `AUTH_SECRET` 变更会让所有设备掉线 + 验证器重绑；`RP_ID` / `ORIGIN` 改了会让已绑定
    Passkey 失效。改这几项前先提示。

## 配置分两组，别混

- **身份验证与启动组**（`.env` / Vercel 环境变量，只在 `/setup`、`/reset` 里改）：
  `MONGODB_URI`、`MONGODB_DB_NAME`、`AUTH_SECRET`、`RECOVERY_TOKEN`、`RP_ID`、`ORIGIN`、
  `NEXT_PUBLIC_SITE_URL`。`AUTH_SECRET` / `RECOVERY_TOKEN` 由程序生成，不手写。
- **服务类组**（也写 `.env`，只在 `/setup`、`/reset` 里改，设置页不提供入口）：
  `STORAGE_PROVIDER`（vercel-blob / s3 / local）、`MAIL_PROVIDER`（resend / smtp）及各自字段。
  没选中的那套不必填。Vercel+Blob 由平台注入 token，用户去 Blob 后台连 store 即可。
- 库名优先级：`MONGODB_DB_NAME` > 连接串路径 > `inslog`；连接串变化自动重连。
- Vercel 文件系统只读：引导页导出 `.env` 供导入到控制台后重新部署。

## 界面语言

站点级，设置 →「外观」→「界面语言」切换即时生效。
`locales/zh-CN.json` 与 `en.json`，**key 就是中文原文**，缺翻译回退中文，占位符 `{name}`。
部署默认值：本地 `config/locale.json`、Vercel `UI_LANGUAGE`；取值只有 `zh-CN` / `en`。
加语言需复制 `en.json` 并在 `i18n-core.ts` 的 `SUPPORTED_LOCALES` 登记。
文章内容与邮件正文不翻译。

## 文档同步

README 已于 2026-11-26 全面重写、与代码对齐（安装向导五步、配置分组、可插拔存储、
RSS / sitemap / 404、目录结构、部署顺序）。**改功能时同步更新 README 与本文件**；
README 与代码冲突时以代码为准，并顺手把文档修掉。

## 安全与交付约定

- 忽略清单覆盖 `config/*.json`（除 example）、`.env*`、`.env*.local`、`uploads/`、
  `public/uploads/`、`backups/`、`.workbuddy/`、`TODO.md`。不要提交连接串、密钥、令牌、真实数据。
- 不要索要或保存 token、`.env`、MongoDB 连接串、`AUTH_SECRET`、`RECOVERY_TOKEN`、
  存储 / 邮件凭据；示例一律用占位值。
- 提交信息沿用仓库的中文短句风格（如「加域名配置自检：RP_ID / ORIGIN 对不上时当场报出来」），
  不强行套 Conventional Commits。
- 交付优先最小 diff / `.patch` > 完整文件；附验证命令与结果。
- 不执行 push、开 PR、合并 main、`reset --hard`、`rebase` 已推送历史、`force push`、删分支。

## 验收基线

```bash
git status --short
git diff --check
npx tsc --noEmit
npm run build
```

再加一句具体行为核对（如「访客直接访问 private 文章返回 404」「/rss.xml 不含 draft」）。
仓库无测试框架；需要引入测试依赖时先提出方案，不要擅自添加。
