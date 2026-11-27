# inslug

一个基于 Node.js + Next.js 的 Blog web APP：让你专注于写作，让读者专注于阅读。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdaveswong%2Finslug%2Ftree%2Frelease&project-name=inslug&repository-name=inslug&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22mongodbatlas%22%2C%22productSlug%22%3A%22atlas%22%2C%22protocol%22%3A%22storage%22%7D%2C%7B%22type%22%3A%22blob%22%2C%22access%22%3A%22public%22%7D%5D)

点上面这个按钮就能得到自己的 inslug：MongoDB Atlas 和图片存储会自动建好，剩下的跟着首页的安装向导点几下就完事。想自己部署的话，看下面的[部署与环境变量](#部署与环境变量)。

**路径短、界面干净、默认安全。** 没有账号系统，没有密码，没有追踪，没有评论，没有推荐算法，
没有弹窗和花哨的装饰。那些烦人的东西离使用者远一点，人才有心思专注在创作本身。

**归属权在你手里。** 内容存在你自己挑的 MongoDB 里，图片放在你自己挑的对象存储里，
邮件走你自己挑的通道。**推荐用 Vercel 部署**——导入仓库、跟着安装向导点几下就完事，是最省事的路子；
但程序不绑死任何一家：自有服务器、Docker、任何能跑 Node 的地方都能装。
数据库、图片存储、邮件都是可插拔的，换一家只是改一个配置。

**边界很清楚。** 它是一个单用户、单站点、纯自用的写作工具。不做多用户、不做后台、
不做社交、不做统计。想让别人看到你的文字，把文章发布出去就行；除此之外，它不替你做任何决定。

**没有主题模板，也不会有。** 外观就这一套，刻意不让人把精力花在折腾博客的样子上——这是设计取舍，不是待办。

## 分支与版本

| 分支 | 给谁 | 说明 |
| --- | --- | --- |
| `main` | 开发者 | 最新代码，随时在改 |
| `release` | 使用者 | 正式发布的版本。上面那个部署按钮用的就是它 |
| `v1.x.0` | 使用者 | 版本标记，对应某个 `release` 提交，可在 Releases 页看更新说明 |

直接 clone 仓库默认拿到 `main`（最新但未必是发布版）。要发布版就切 `release` 分支，或去 [Releases](https://github.com/daveswong/inslug/releases) 下对应版本的源码包。

## 现在能用的

- **读写闭环**：首页时间线（只有日期 + 标题，无摘要无封面、要分页）→ 文章详情 → 站内搜索 → 写作页（BlockNote 类 Notion 所见即所得）→ 存 MongoDB。
- **文章**：可见性三态 `draft`（草稿）/ `private`（私有）/ `public`（公开），访客只读 public，私有与草稿直接访问也 404；发布不超过 6 个月的公开文章标 `new`；可置顶（列表和详情都不显示置顶标记，位置本身就是信号）。
- **标签与地址**：tag 手动创建 + 选择，未被任何文章引用的自动删除；公开标签目录只列 public 用过的标签，防草稿内容泄露；slug 由标题拼音 + 随机后缀生成，改标题不改 URL。
- **登录**：Passkey（WebAuthn）为主、手机验证器 TOTP（扫码绑定、6 位码）为辅，**没有密码**；两把钥匙都丢了走 `/login?recovery=1` + `RECOVERY_TOKEN`。`proxy.ts` 只保护 `/write` 与 `/settings` 并粗筛 cookie，真正的验签在页面层。
- **敏感操作邮件确认**：更换 / 解绑验证器、新增 / 删除 Passkey、重置配置都要发确认信，链接 10 分钟有效、只能用一次，确认页再点一次才生效（首次绑定验证器除外）。
- **站点设置**：四组平铺——站点信息（基本信息 + SEO）/ 外观（主题、界面语言、图片地址、每页文章数、页脚）/ 社交链接（自定义标题 + 网址，条数不限）/ 安全（通知邮箱、Passkey、验证器）。一个保存按钮，只提交改过的字段；主题和界面语言独立、点一下即生效。
- **对外输出**：RSS 2.0、`sitemap.xml`、`robots.txt`、自定义 404 都已实现，RSS 与 sitemap 只输出 public 文章；SEO 元信息、canonical、og、分享图齐全。
- **可插拔服务**：图片 `vercel-blob` / `s3` / `local`，发信 `resend` / `smtp`，都在安装向导里选方案、填字段、写进 `.env`；正文里的图片只存 URL。
- **安装与恢复**：`/setup` 五步向导（含域名自检）、`/reset` 恢复指引（可生成临时密钥，自己去服务端配置）、`/api/diag` 域名诊断、`npm run backup` 导出文章与设置。
- **不娇气**：数据库还没配好时首页 / 文章页显示安装提示，`rss.xml` 与 `sitemap.xml` 返回 503，而不是抛 500；`MONGODB_DB_NAME` 指向一个还不存在的库时，安装向导会自动建出来。

## 本地跑起来

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。**不用先手动创建任何配置文件**：全新站点会在首页给出安装入口，直接进 `/setup` 走向导即可，配置由向导写进项目根目录的 `.env`。

想绕开向导手动配也可以：`config/database.example.json` → `config/database.json` 填连接串，`.env.example` 里按需打开几项另存为 `.env.local`。

读取规则：`MONGODB_URI` 先从 `.env` / `.env.local` / 进程环境变量里找（**文件优先于环境变量**，因为向导把值写进文件后，进程环境变量不会跟着变——那是启动时注入的）；三个都没有才回退到 `config/database.json`。这些文件都在 `.gitignore` 里，**切勿提交到 GitHub**。

```bash
node scripts/test-connection.mjs   # 只读：ping + 列出集合
node scripts/seed-demo.mjs         # 演示数据，可重复执行重灌
npm run backup                     # 导出文章 / 标签 / 设置到 backups/，不导出凭据
npx tsc --noEmit                   # 类型检查
npm run build                      # 生产构建
```

> Atlas 报 `SSL alert internal error` 多半是 IP 白名单问题：到 Network Access 加当前出口 IP。
> 仓库没有 test / lint 脚本，验收以 `tsc --noEmit` + `npm run build` 加具体行为核对为准。

## 首次安装（`/setup`）

五步：**服务器配置 → 站点信息 → 绑定 Passkey → 绑定手机验证器 → 完成**。

第 1 步在站点**还没有任何登录凭据**时免登录（新部署可能连数据库都没配，除此之外别无入口）；一旦有了凭据，再改这些配置必须先登录，而且免登录时不会覆盖已有值。向导会摆出当前域名、服务器读到的 `RP_ID` 与 `ORIGIN`，对不上时当场报错，不用等浏览器抛英文错。

`AUTH_SECRET` 与 `RECOVERY_TOKEN` 由程序生成（32 字节随机数，base64 后 44 字符），不接受手填，也只在生成那一次显示——请立刻存进密码管理器。填完主按钮：

- **自有服务器 / Docker**：写入项目根目录 `.env`，刷新即生效，并顺手下载一份留底。
- **Vercel**：文件系统只读，点「生成 .env 文件」下载，导入到 Vercel → 项目 → Settings → Environment Variables，**然后重新部署**。变量生效前紧急入口是关着的，漏掉重新部署这一步就会卡住。

Vercel 上的完整顺序：

1. 导入 GitHub 仓库并部署（可以先不配任何变量，站点会显示安装提示）
2. 打开 `/setup`，第 1 步填数据库地址、库名、`RP_ID`、`ORIGIN`，生成密钥并下载 `.env`
3. 把 `.env` 导入 Vercel 环境变量，重新部署并等它跑完
4. 回 `/login`——安装未完成时会自动显示紧急登录入口——用 `.env` 里的 `RECOVERY_TOKEN` 进门
5. 继续第 2–5 步：站点信息（**通知邮箱要填**，见下）→ 绑 Passkey → 扫码绑验证器 → 点「完成安装」

> **绑 Passkey 的前置条件**：新增 Passkey 也要走邮件确认，所以第 1 步里得选好发信方案并填好凭据，第 2 步里得填通知邮箱，否则「申请绑定新的 Passkey」按钮是禁用的。确认信点开链接后再回向导点「完成绑定」。
> 完成后 `settings.setupCompleted = true`，从登录页进首页不再自动改道。

改这几项前先想清楚：`RP_ID` / `ORIGIN` 改了会让已绑定的 Passkey 失效；`AUTH_SECRET` 改了会让所有设备掉线、验证器要重绑；`MONGODB_URI` 改了会立刻重连数据库，页面可能短暂打不开。`/api/diag` 只返回 `rpId` / `origin` / 当前请求域名和匹配结论，不返回密钥或连接串。

**凭据不会留在前端。** 向导里的配置表单只用来生成或写入 `.env`：值不会注入正在运行的进程，已配置的密钥不回显，站点设置页完全不碰这些。站点初始化之后，再改这些配置只能走安装 / 重置引导，且必须先登录。

## 配置分两组

两组都写进同一个地方：项目根目录的 `.env` 文件（Vercel 上是环境变量）。

| 组 | 内容 | 什么时候能改 |
| --- | --- | --- |
| 身份验证与启动 | `MONGODB_URI`、`MONGODB_DB_NAME`、`RP_ID`、`ORIGIN`（手填）+ `AUTH_SECRET`、`RECOVERY_TOKEN`（程序生成）+ `SETTINGS_STORE`（存哪儿） | 只在安装 / 重置引导里 |
| 服务类 | 图片存储（`STORAGE_PROVIDER` + 各方案字段）、发信（`MAIL_PROVIDER` + 各方案字段） | 只在安装 / 重置引导里改；非 Vercel 改完约 3 秒生效，Vercel 要重新部署 |

服务类可插拔：先选方案，再只填这个方案要的字段，没选的那套不参与也不必填。默认走最省事的那条（Vercel Blob + Resend）。它不存数据库——改乱了在服务端 `.env` 里一眼能查到、改回来。Vercel 上若选 Vercel Blob，连接 store 时勾上「Add a read-write token env var」，token 由平台自动注入，不用填。

### 站点设置存在哪儿

`SETTINGS_STORE` 决定站点设置（站名、简介、社交链接、分页大小这些）放在哪儿，两个选项：

| 值 | 存在哪 | 适合谁 | 代价 |
| --- | --- | --- | --- |
| `mongodb`（默认） | 数据库的 `settings` 集合 | 大多数人 | 跟着数据库一起备份；换库要带着走 |
| `file` | 项目根目录的 `config/settings.json` | 想让站点信息独立于数据库，或想直接手改这个文件的 | 只有文件系统可写时可用（Vercel 不行）；文件不进 Git，服务器重建就丢 |

`file` 后端的实际行为：改完立即生效，不用连数据库；数据库只放文章、标签这些内容。两边的数据互相独立——站点设置不会因为数据库清空而丢。文章永远在 MongoDB 里，`file` 只管站点设置。

在安装向导第 1 步就能选。选之前程序会确认当前平台能不能写文件：Vercel 的文件系统只读，所以那边只提供 MongoDB；自部署（自有服务器 / Docker）两个都能选。选完写在 `.env` 的 `SETTINGS_STORE` 里，部署时定好，程序不猜。

切换后端不会自动搬运数据——从 `mongodb` 切到 `file` 时，站点设置会变成默认值（因为文件里还没有）；反方向同理。要保留原来的内容，先把旧地方的值抄过来。

**「重置配置」不会碰 `config/settings.json`**：它只清 `.env` 里的配置项，`SETTINGS_STORE` 本身也在重置范围之外（它是「设置存哪儿」的选择，不是凭据）。想清空配置文件里的设置，自己删那个文件。

### 为什么没有 Global Config

Vercel 的 Storage 里还有个 Global Config（原 Edge Config），是个全球分布的 KV 存储，读起来极快。inslug 没有接它，原因是它对博客这种用法不划算：

- **写不进去**：SDK 只能读，写必须走 Vercel REST API，要一个账号级 API token、Global Config ID、Team ID 四样东西。那是能改整个 Vercel 账号的凭据，让博客作者去配它不合适。
- **改了不马上生效**：写入最多 10 秒才全球传播，改完设置刷新可能看到旧值。
- **写有配额**：免费额度每月 100 次写。

它更适合企业官网那类场景：配置由运维统一管、读多写少、变更走发布流程、团队本来就有 Vercel 管理权限。对个人博客，省下的只是一次数据库读取，代价却是把「填个连接串」变成「配四个变量并理解令牌权限」——不值得。想要快读的思路在博客这里本来就用不上：站点设置是每页读一次的小数据，不是热点数据。

## 恢复与重置

- 进不去先看 `/reset`：未登录只给通用步骤、不泄露任何状态；登录后按实际状态列出 Passkey 数量、验证器 / 邮件确认 / 紧急密钥是否就绪，并给出下一步。
- 两把钥匙都丢了：`/reset` 页面能生成一把临时密钥（只生成、不写文件、不回显已有配置），自己填进服务端 `.env` 或 Vercel 环境变量 → 生效后用 `/login?recovery=1` 进门 → 立刻重绑 Passkey 和验证器 → 删掉这把临时密钥（删了就没有兜底）。只有能改服务器配置的人才是站点拥有者，别人拿到密钥也没用。
- 彻底清空凭据：删数据库 `auth` 集合的 `admin` 文档等于解绑验证器，删 `passkeys` 集合等于清空所有 Passkey，再从 `/setup` 重来。
- 「重置配置」要过邮件确认：清掉 auth 组和 service 组在 `.env` 里的键；**站点设置、文章、标签、已绑定的 Passkey 与验证器都不动**。Vercel 上程序删不掉的环境变量，会在确认后逐个列出，由你手动去控制台删除。

## 部署与环境变量

**最省事的一条路**：点 README 顶部的 Deploy 按钮。Vercel 会把 `release` 分支克隆到**你自己的
GitHub 账号**下，顺手建好 MongoDB Atlas 数据库和图片存储，然后你跟着首页的安装向导走完剩下几步。

要点：部署完之后还有一步——Vercel 的环境变量改动要重新部署才生效。向导第 1 步会把要填的
变量列成清单给你，照着填进 Vercel 的 Environment Variables，再重新部署一次，站点就能用了。

自己部署的话：导入 GitHub 仓库（框架自动识别 Next.js）→ 按上面的向导配置 → 绑定域名，DNS 托管在 Vercel 时 HTTPS 证书自动签发。自部署用 `npm run build && npm run start`，`.env` 放在项目根目录。

数据库连接串是通用的：Atlas、自建、Railway、容器里的 MongoDB 都行。库名优先级 `MONGODB_DB_NAME` > 连接串路径里的名字 > `inslug`；同一集群跑多个站点时用不同库名区分，填一个不存在的库名，安装向导会自动建出来。

**inslug 只用 MongoDB**，不兼容 Postgres / Redis 那一类——数据层是 MongoDB 原生驱动加聚合管道（置顶排序、时间线排序都靠 `$ifNull` 补字段），换库等于重写数据层，不是换个连接串的事。

MongoDB 的部署方式有三条，按需要挑：

| 方式 | 怎么弄 | 适合谁 | 代价 |
| --- | --- | --- | --- |
| **Vercel 里一键开通** | Dashboard → Storage → Create Database → 选 MongoDB Atlas → Continue → 建资源 → Connect to Project。Vercel 自动注入 `MONGODB_URI` | 不想注册第三家平台 | **只能新建账号和集群**，接不了你已有的 Atlas；账单并入 Vercel |
| **自己的 Atlas**（mongodb.com） | 注册后建集群、Database Access 建用户、Network Access 加白名单，复制连接串填进向导 | 已经在用 Atlas，或想自己管 | 免费层（M0）存储上限 512MB、每周传输 10GB；**闲置 30 天且零连接会自动暂停**（可恢复，不是删除）；每账号只能建 1 个免费集群 |
| **Railway / 自建 / Docker** | 自己跑一个 MongoDB，填 `mongodb://` 连接串 | 想完全掌控 | 全部自己运维：备份、升级、安全补丁都归你 |

新手直接用第一条：什么都不用懂，点几下就有连接串。

**Vercel 上一定要做的一件事**：Atlas 的 Network Access 白名单要放开 `0.0.0.0/0`。Vercel 的出口 IP 不固定（每次部署可能不同），没法按 IP 白名单放行，只能全开。

### 环境变量速查

前六项由安装向导填写或生成，`SETTINGS_STORE` 可选，后两项需要时手动加：

| 变量 | 说明 |
| --- | --- |
| `MONGODB_URI` | MongoDB 连接串，向导里填；Vercel 的 Atlas 集成会自动注入 |
| `MONGODB_DB_NAME` | 库名，可选，向导里填 |
| `AUTH_SECRET` | 会话签名 + 加密 TOTP secret 的密钥，程序生成 |
| `RECOVERY_TOKEN` | 紧急入口密钥，程序生成，进门全靠它 |
| `RP_ID` | Passkey 域名主体，如 `inslug.example.com`，**必须与正式域名一致** |
| `ORIGIN` | 站点完整地址，如 `https://inslug.example.com`，确认邮件链接按它拼 |
| `SETTINGS_STORE` | 站点设置存哪儿：`mongodb`（默认）或 `file`。部署时定，见上一节；「重置配置」不会清它 |
| `NEXT_PUBLIC_SITE_URL` | 可选。canonical / 分享图 / RSS 用；不填则回退到 `ORIGIN`。向导不生成，需要时手动加 |
| `UI_LANGUAGE` | 可选。部署期默认界面语言（`zh-CN` / `en`），也可写进 `config/locale.json`；日常在设置页切，不用碰它 |

### 服务类（安装向导第 1 步填写，写进 .env）

| 功能 | 方案与字段 |
| --- | --- |
| 图片 `STORAGE_PROVIDER` | `vercel-blob`：`BLOB_READ_WRITE_TOKEN`（store 必须 **Public**，创建后不可改）<br>`s3`：`S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_URL`（R2 / MinIO / AWS S3 / OSS…，桶要允许匿名读）<br>`local`：`LOCAL_UPLOAD_DIR`（默认 `uploads`，目录要可写；多实例需共享） |
| 发信 `MAIL_PROVIDER` | `resend`：`RESEND_API_KEY`、`RESEND_FROM`（域名先验证 SPF / DKIM）<br>`smtp`：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`、`SMTP_SECURE`（QQ / Gmail 用授权码，不是登录密码） |

发信没配好（或通知邮箱为空）时，换绑 / 解绑验证器与增删 Passkey 会被禁用，而不是降级放行。非 Vercel 组合未做人工实测，靠代码正确性与明确报错兜底，以后由使用者反馈。

**图片存储用 Vercel Blob 的话**：Dashboard → Storage → Create Database → 选 Blob → 建 store（访问权限必须选 **Public**，建完不可改）→ 连到项目。

连上之后 Vercel 自动注入环境变量，**不用手填任何东西**。默认注入的是 OIDC 凭据（`BLOB_STORE_ID` 和自动轮换的 `VERCEL_OIDC_TOKEN`）。另外还有一个开关 "Add a read-write token env var"，勾上会多注入一个长期令牌 `BLOB_READ_WRITE_TOKEN`。

inslug 的图片是**浏览器直传**的（要生成给前端的 client token），这正是官方说明里需要长期令牌的那两种情况之一，所以连接时要**勾上这个开关**。不勾的话图片插不进去。两种凭据都在环境变量里，程序不需要用户手动抄。

> 忽略清单覆盖 `.env*`、`.env*.local`、`config/*.json`（除 `*.example.json`）、`uploads/`、`public/uploads/`、`backups/`。连接串、密钥、令牌、真实文章数据一律不进仓库。

## 界面语言

界面文案（按钮、提示、错误）支持中文 / 英文，**文章内容不翻译**。语言包在 `locales/zh-CN.json` 与 `locales/en.json`，键就是中文原文，缺翻译时自动回退到中文。

日常切换在站点设置 →「外观」→「界面语言」，点「中文 / English」立刻生效，不用改环境变量、不用重新部署；语言是站点级的。部署期默认值另有两个入口：本地 `cp config/locale.example.json config/locale.json` 改 `locale`，Vercel 加 `UI_LANGUAGE`。取值只有 `zh-CN` 和 `en`。想加语言就复制一份 `en.json` 并在 `src/lib/i18n-core.ts` 的 `SUPPORTED_LOCALES` 里登记。

## 代码注释与编码

代码里的注释是**用中文写的**。用编辑器打开源码时，请确认编码设为 **UTF-8**，否则中文注释会显示成乱码。如果看不懂中文，要么学一点中文，要么用中国的 AI 工具把注释翻译成你的母语——别把乱码当成代码坏了。

## 目录结构

```
src/
  app/
    page.tsx                  # 首页：站点信息 + 搜索 + 标签 + 文章时间线
    layout.tsx                # 外壳 + SEO 元信息
    globals.css               # 全部样式（CSS 变量支持夜览模式）
    posts/[slug]/             # 文章详情
    search/  write/  login/   # 站内搜索 / 写作（server action）/ 登录
    settings/                 # 四组平铺的设置表单；Passkey、验证器、主题、语言在这里
    setup/  reset/            # 首次安装向导 / 恢复指引
    confirm/[token]/          # 邮件确认页（凭据变更真正生效的地方）
    uploads/[...path]/        # 本地存储方案下的图片回读
    not-found.tsx             # 自定义 404
    rss.xml/  sitemap.xml/  robots.txt/
    api/                      # auth/*（passkey、totp、recovery、logout）、setup/*、upload*（三套存储）、diag
  components/                 # BlockEditor、PostBody、SiteFooter、WriteFab、i18n-provider、install-hint、service-config-fields
  lib/                         # mongodb / posts / settings / settings-file / auth / session / passkey / totp /
                               # secret-box / pending / change-request / env-store / env-config / service-config /
                               # storage / mail / rate-limit / site-url / safe-path / i18n-core …
  proxy.ts                     # 只粗筛 /write 与 /settings 的 cookie，验签留给页面层 isLoggedIn()
config/*.example.json          # 配置模板（提交）；实际 database.json / locale.json / settings.json 被忽略
locales/*.json                 # 界面语言包（键是中文原文）
scripts/                       # 连通测试 / 演示数据 / 导出备份（_db.mjs 是共用连接模块）
public/                        # 图标
```

## 图标

`public/` 下是 ins 连笔字标的三套版本（笔尖构成 I，一笔画出 n 与 s，外圈圆角方形）：

| 文件 | 用途 |
| --- | --- |
| `favicon.ico` | 标签栏图标（白底黑字，含 16–256 共 7 个尺寸） |
| `icon.svg` | 现代浏览器的标签栏图标（白底黑字） |
| `icon-dark.svg` | 深色底版本，需要时手动引用 |
| `icon-color.png` | 分享卡片图（og:image / twitter:image），默认用它 |
| `icon-color.svg` | 渐变彩色矢量版 |
| `apple-touch-icon.png` | iOS 添加到主屏幕的图标（黑底白字） |

设置页里填了 favicon 会覆盖上面这套默认值。

## 开源协议

本项目采用 [MIT License](./LICENSE)，并附加一条要求：**任何公开部署都必须保留指向本项目源码仓库的可见链接**，让更多人能找到并使用它。该链接位于页脚，独立于站点自己的内容与社媒链接，也不在站点设置中修改。

> 链接位置在 `src/components/SiteFooter.tsx`，全站共用，改一处即可。

## 参与开发

```bash
git clone https://github.com/daveswong/inslug.git
cd inslug
npm install
npm run dev
```

改动走 `main`。发布由维护者用一条命令完成：

```bash
npm run release 1.0.0
```

它会把 `main` 的内容推成 `release` 分支、打上 `v1.0.0` 标签，并给出创建 Release 说明的链接。
`release` 分支是 `main` 的镜像，不接受直接提交——要让改动出现在发布版里，合并进 `main` 再说。

**提交信息用中文短句**，说清做了什么就行，不用套 Conventional Commits。
