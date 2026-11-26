# inslug

一个自己用的博客。程序只是程序——它只做一件事：让你安静地写、存、传自己的内容。

**路径短、界面干净、默认安全。** 没有账号系统，没有密码，没有追踪，没有评论，没有推荐算法，
没有弹窗和花哨的装饰。那些烦人的东西离使用者远一点，人才有心思专注在创作本身。

**归属权在你手里。** 内容存在你自己挑的 MongoDB 里，图片放在你自己挑的对象存储里，
邮件走你自己挑的通道。**推荐用 Vercel 部署**——导入仓库、跟着安装向导点几下就完事，是最省事的路子；
但程序不绑死任何一家：自有服务器、Docker、任何能跑 Node 的地方都能装。
数据库、图片存储、邮件都是可插拔的，换一家只是改一个配置。

**边界很清楚。** 它是一个单用户、单站点、纯自用的写作工具。不做多用户、不做后台、
不做社交、不做统计。想让别人看到你的文字，把文章发布出去就行；除此之外，它不替你做任何决定。

## 现在能用的

- **读写闭环**：首页时间线（只有日期 + 标题，无摘要无封面、要分页）→ 文章详情 → 站内搜索 → 写作页（BlockNote 类 Notion 所见即所得）→ 存 MongoDB。
- **文章**：可见性三态 `draft`（草稿）/ `private`（私有）/ `public`（公开），访客只读 public，私有与草稿直接访问也 404；发布不超过 6 个月的公开文章标 `new`；可置顶（列表和详情都不显示置顶标记，位置本身就是信号）。
- **标签与地址**：tag 手动创建 + 选择，未被任何文章引用的自动删除；公开标签目录只列 public 用过的标签，防草稿内容泄露；slug 由标题拼音 + 随机后缀生成，改标题不改 URL。
- **登录**：Passkey（WebAuthn）为主、手机验证器 TOTP（扫码绑定、6 位码）为辅，**没有密码**；两把钥匙都丢了走 `/login?recovery=1` + `RECOVERY_TOKEN`。middleware 只保护 `/write` 与 `/settings`，真正的验签在 Node 侧。
- **敏感操作邮件确认**：更换 / 解绑验证器、新增 / 删除 Passkey、重置配置都要发确认信，链接 10 分钟有效、只能用一次，确认页再点一次才生效（首次绑定验证器除外）。
- **站点设置**：8 个折叠分组——基本信息 / 列表与页脚 / SEO / 通知 / 社交链接 / 外观 / 邮件与图片存储 / 登录。主题跟随系统、可固定浅色或深色；界面语言中文 / English 切换即时生效。
- **对外输出**：RSS 2.0、`sitemap.xml`、`robots.txt`、自定义 404 都已实现，RSS 与 sitemap 只输出 public 文章；SEO 元信息、canonical、og、分享图齐全。
- **可插拔服务**：图片 `vercel-blob` / `s3` / `local`，发信 `resend` / `smtp`，配置存数据库，改了不用重新部署；正文里的图片只存 URL。
- **安装与恢复**：`/setup` 五步向导（含域名自检）、`/reset` 恢复指引、`/api/diag` 域名诊断、`npm run backup` 导出文章与设置。
- **不娇气**：数据库还没配好时首页 / 文章页显示安装提示，`rss.xml` 与 `sitemap.xml` 返回 503，而不是抛 500；`MONGODB_DB_NAME` 指向一个还不存在的库时，安装向导会自动建出来。

## 本地跑起来

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。**不用先手动创建任何配置文件**：全新站点会在首页给出安装入口，直接进 `/setup` 走向导即可，配置由向导写进项目根目录的 `.env`。

想绕开向导手动配也可以：`config/database.example.json` → `config/database.json` 填连接串，`.env.example` 里按需打开几项另存为 `.env.local`。读取顺序是 进程环境变量 → `.env` → `.env.local` → `config/database.json`。这些文件都在 `.gitignore` 里，**切勿提交到 GitHub**。

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

| 组 | 内容 | 存哪 | 什么时候能改 |
| --- | --- | --- | --- |
| 身份验证与启动 | `MONGODB_URI`、`MONGODB_DB_NAME`、`RP_ID`、`ORIGIN`（手填）+ `AUTH_SECRET`、`RECOVERY_TOKEN`（程序生成） | `.env` 文件 / Vercel 环境变量 | 只在安装 / 重置引导里 |
| 服务类 | 图片存储（`STORAGE_PROVIDER` + 各方案字段）、发信（`MAIL_PROVIDER` + 各方案字段） | 数据库 | 部署之后在设置页随时改，不用重新部署 |

服务类可插拔：先选方案，再只填这个方案要的字段，没选的那套不参与也不必填。默认走最省事的那条（Vercel Blob + Resend）。

## 恢复与重置

- 进不去先看 `/reset`：未登录只给通用步骤、不泄露任何状态；登录后按实际状态列出 Passkey 数量、验证器 / 邮件确认 / 紧急密钥是否就绪，并给出下一步。
- 两把钥匙都丢了：确认 `RECOVERY_TOKEN` 已生效 → `/login?recovery=1` 粘贴密钥进门 → 立刻重绑 Passkey 和验证器 → 之后可以删掉这把临时密钥（删了就没有兜底）。
- 彻底清空凭据：删数据库 `auth` 集合的 `admin` 文档等于解绑验证器，删 `passkeys` 集合等于清空所有 Passkey，再从 `/setup` 重来。
- 「重置配置」要过邮件确认：只清 auth 组的 `.env` 键与 service 组的数据库配置；**站点设置、文章、标签、已绑定的 Passkey 与验证器都不动**。Vercel 上程序删不掉的环境变量，会在确认后逐个列出，由你手动去控制台删除。

## 部署与环境变量

推荐 Vercel：导入 GitHub 仓库（框架自动识别 Next.js）→ 按上面的向导配置 → 绑定域名，DNS 托管在 Vercel 时 HTTPS 证书自动签发。自部署用 `npm run build && npm run start`，`.env` 放在项目根目录。

数据库连接串是通用的：Atlas、自建、Railway、容器里的 MongoDB 都行。库名优先级 `MONGODB_DB_NAME` > 连接串路径里的名字 > `inslug`；同一集群跑多个站点时用不同库名区分，填一个不存在的库名，安装向导会自动建出来。

### 环境变量速查

前六项由安装向导填写或生成，后两项可选、需要时手动加：

| 变量 | 说明 |
| --- | --- |
| `MONGODB_URI` | MongoDB 连接串，向导里填 |
| `MONGODB_DB_NAME` | 库名，可选，向导里填 |
| `AUTH_SECRET` | 会话签名 + 加密 TOTP secret 的密钥，程序生成 |
| `RECOVERY_TOKEN` | 紧急入口密钥，程序生成，进门全靠它 |
| `RP_ID` | Passkey 域名主体，如 `inslug.example.com`，**必须与正式域名一致** |
| `ORIGIN` | 站点完整地址，如 `https://inslug.example.com`，确认邮件链接按它拼 |
| `NEXT_PUBLIC_SITE_URL` | 可选。canonical / 分享图 / RSS 用；不填则回退到 `ORIGIN`。向导不生成，需要时手动加 |
| `UI_LANGUAGE` | 可选。部署期默认界面语言（`zh-CN` / `en`）；日常在设置页切，不用碰它 |

### 服务类（设置页 →「邮件与图片存储」，存数据库）

| 功能 | 方案与字段 |
| --- | --- |
| 图片 `STORAGE_PROVIDER` | `vercel-blob`：`BLOB_READ_WRITE_TOKEN`（store 必须 **Public**，创建后不可改）<br>`s3`：`S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_URL`（R2 / MinIO / AWS S3 / OSS…，桶要允许匿名读）<br>`local`：`LOCAL_UPLOAD_DIR`（默认 `uploads`，目录要可写；多实例需共享） |
| 发信 `MAIL_PROVIDER` | `resend`：`RESEND_API_KEY`、`RESEND_FROM`（域名先验证 SPF / DKIM）<br>`smtp`：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`、`SMTP_SECURE`（QQ / Gmail 用授权码，不是登录密码） |

发信没配好（或通知邮箱为空）时，换绑 / 解绑验证器与增删 Passkey 会被禁用，而不是降级放行。非 Vercel 组合未做人工实测，靠代码正确性与明确报错兜底，以后由使用者反馈。

> 忽略清单覆盖 `.env*`、`.env*.local`、`config/*.json`（除 `*.example.json`）、`uploads/`、`public/uploads/`、`backups/`。连接串、密钥、令牌、真实文章数据一律不进仓库。

## 界面语言

界面文案（按钮、提示、错误）支持中文 / 英文，**文章内容不翻译**。语言包在 `locales/zh-CN.json` 与 `locales/en.json`，键就是中文原文，缺翻译时自动回退到中文。

日常切换在站点设置 →「外观」→「界面语言」，点「中文 / English」立刻生效，不用改环境变量、不用重新部署；语言是站点级的。部署期默认值另有两个入口：本地 `cp config/locale.example.json config/locale.json` 改 `locale`，Vercel 加 `UI_LANGUAGE`。取值只有 `zh-CN` 和 `en`。想加语言就复制一份 `en.json` 并在 `src/lib/i18n-core.ts` 的 `SUPPORTED_LOCALES` 里登记。

## 目录结构

```
src/
  app/
    page.tsx                  # 首页：站点信息 + 搜索 + 标签 + 文章时间线
    posts/[slug]/             # 文章详情
    search/  write/  login/   # 站内搜索 / 写作（server action）/ 登录
    settings/                 # 8 个折叠分组；Passkey、验证器、服务配置都在这里
    setup/  reset/            # 首次安装向导 / 恢复指引
    confirm/[token]/          # 邮件确认页（凭据变更真正生效的地方）
    not-found.tsx             # 自定义 404
    rss.xml/  sitemap.xml/  robots.txt/
    api/                      # auth/*（passkey、totp、recovery、logout）、setup/*、upload*（三套存储）、diag
  components/                 # BlockEditor、PostBody、SiteFooter、WriteFab、i18n-provider、各类设置表单
  lib/                         # mongodb / posts / settings / auth / session / passkey / totp /
                               # secret-box / pending / change-request / env-store / service-config / i18n-core …
  middleware.ts                # 只粗筛 /write 与 /settings 的 cookie，验签留给 Node 侧
config/*.example.json          # 配置模板（提交）；实际 database.json / locale.json 被忽略
locales/*.json                 # 界面语言包
scripts/                       # 连通测试 / 演示数据 / 导出备份
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
