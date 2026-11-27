# inslog

一个基于 Node.js + Next.js 的 Blog web APP：让你专注于写作，让读者专注于阅读。

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
| `main` | 使用者 | 正式发布的版本。用户部署的就是它 |
| `nightly` | 开发者 | 开发分支，改动都在这儿做，测通了才发到 `main` |

直接 clone 仓库默认拿到 `main`，那就是发布版。开发的话切 `nightly` 分支。

## 现在能用的

- **读写闭环**：首页时间线（只有日期 + 标题，无摘要无封面、要分页）→ 文章详情 → 站内搜索 → 写作页（BlockNote 类 Notion 所见即所得）→ 存 MongoDB。
- **文章**：可见性三态 `draft`（草稿）/ `private`（私有）/ `public`（公开），访客只读 public，私有与草稿直接访问也 404；发布不超过 6 个月的公开文章标 `new`；可置顶（列表和详情都不显示置顶标记，位置本身就是信号）。
- **标签与地址**：tag 手动创建 + 选择，未被任何文章引用的自动删除；公开标签目录只列 public 用过的标签，防草稿内容泄露；slug 由标题拼音 + 随机后缀生成，改标题不改 URL。
- **文章附件**：任意类型文件（PDF、STEP、DXF、ZIP 之类都行），单个最大 50MB，走和图片同一套存储；上传后以一列下载链接挂在文章末尾供访客下载。下载链接一律强制下载——附件可能是 HTML、SVG 这类浏览器会直接渲染的类型，在自己域名下渲染访客带来的文件等于把会话交出去。
- **登录**：Passkey（WebAuthn）为主、手机验证器 TOTP（扫码绑定、6 位码）为辅，**没有密码**；两把钥匙都丢了走 `/login?recovery=1` + `RECOVERY_TOKEN`。`proxy.ts` 只保护 `/write` 与 `/settings` 并粗筛 cookie，真正的验签在页面层。
- **敏感操作邮件确认**：绑定 / 更换 / 解绑验证器、新增 / 删除 Passkey 都要发确认信，链接 10 分钟有效、只能用一次，确认页再点一次才生效。
- **站点设置**：四组平铺——站点信息（基本信息 + SEO）/ 外观（主题、界面语言、图片地址、每页文章数、页脚）/ 社交链接（自定义标题 + 网址，条数不限）/ 安全（通知邮箱、Passkey、验证器）。一个保存按钮，只提交改过的字段；主题和界面语言独立、点一下即生效。
- **对外输出**：RSS 2.0、`sitemap.xml`、`robots.txt`、自定义 404 都已实现，RSS 与 sitemap 只输出 public 文章；SEO 元信息、canonical、og、分享图齐全。
- **可插拔服务**：图片与附件 `vercel-blob` / `s3` / `local`，发信 `resend` / `smtp`，都在安装向导里选方案、填字段、写进 `.env`；正文里的图片和附件都只存 URL。
- **安装**：`/setup` 只有一步——配环境变量，检查通过即完成安装并跳到登录页；通知邮箱、Passkey、验证器都在首次登录后到站点设置里配。登不上用 `.env` / 环境变量里的 `RECOVERY_TOKEN` 从紧急入口进。站点没有重置功能。`npm run backup` 导出文章与设置。
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
npm run backup                     # 导出文章 / 标签 / 设置 / 附件清单到 backups/，不导出凭据
npx tsc --noEmit                   # 类型检查
npm run build                      # 生产构建
```

> Atlas 报 `SSL alert internal error` 多半是 IP 白名单问题：到 Network Access 加当前出口 IP。
> 仓库没有 test / lint 脚本，验收以 `tsc --noEmit` + `npm run build` 加具体行为核对为准。

## 首次安装（`/setup`）

**只有一步：配置服务器环境变量，点「检查配置，完成安装」。** 检查通过即标记安装完成，跳到登录页。
通知邮箱、Passkey、验证器都不在安装流程里——首次登录后到**站点设置**里配。

这一页在站点**还没有任何登录凭据**时免登录（新部署可能连数据库都没配，除此之外别无入口）；一旦有了凭据，再改这些配置必须先登录，而且免登录时不会覆盖已有值。向导会摆出当前域名、服务器读到的 `RP_ID` 与 `ORIGIN`，对不上时当场报错。「检查配置」会核对数据库串、`RP_ID`、`ORIGIN`、两把密钥、发信是否都已生效；**文件存储不算必填**（Vercel 上可在后台连 Blob 自动注入，其它环境建议现在配好）。

`AUTH_SECRET` 与 `RECOVERY_TOKEN` 由程序生成（32 字节随机数，base64 后 44 字符），不接受手填，也只在生成那一次显示——请立刻存进密码管理器。填完主按钮：

- **自有服务器 / Docker**：写入项目根目录 `.env`，刷新即生效，并顺手下载一份留底。
- **Vercel**：文件系统只读，点「生成 .env 文件」下载，导入到 Vercel → 项目 → Settings → Environment Variables，**然后重新部署**。变量生效前「检查配置」读不到新值，漏掉重新部署这一步会卡住。

Vercel 上的完整顺序：

1. 导入 GitHub 仓库并部署（可以先不配任何变量，站点会显示安装提示）
2. 打开 `/setup`，填数据库地址、库名、`RP_ID`、`ORIGIN`，选好发信方案、生成密钥并下载 `.env`
3. 把 `.env` 导入 Vercel 环境变量，重新部署并等它跑完
4. 回 `/setup` 点「检查配置，完成安装」，通过后跳到登录页
5. 用 `.env` 里的 `RECOVERY_TOKEN` 从紧急入口登录，进站点设置填通知邮箱、绑 Passkey 和验证器

> **绑 Passkey / 验证器的前置条件**：增删凭据都要邮件确认，所以安装时得选好发信方案、填好凭据，登录后到设置页填好通知邮箱，否则「绑定 / 换绑」按钮是禁用的。
> 完成后 `settings.setupCompleted = true`，从登录页进首页不再自动改道。

**站点没有重置功能。** 登不上（两把钥匙都丢）就用 `.env` / 环境变量里的 `RECOVERY_TOKEN` 从 `/login?recovery=1` 进门，进去后到设置页重新绑定 Passkey 和验证器。

改这几项前先想清楚：`RP_ID` / `ORIGIN` 改了会让已绑定的 Passkey 失效——填之前对照当前域名（安装页会显示服务器读到的值和当前域名）；`AUTH_SECRET` 改了会让所有设备掉线、验证器要重绑；`MONGODB_URI` 改了会立刻重连数据库，页面可能短暂打不开。

**凭据不会留在前端。** 向导里的配置表单只用来生成或写入 `.env`：值不会注入正在运行的进程，已配置的密钥不回显，站点设置页完全不碰这些。站点初始化之后，再改这些配置只能走安装向导，且必须先登录。

## 配置分两组

两组都写进同一个地方：项目根目录的 `.env` 文件（Vercel 上是环境变量）。

| 组 | 内容 | 什么时候能改 |
| --- | --- | --- |
| 身份验证与启动 | `MONGODB_URI`、`MONGODB_DB_NAME`、`RP_ID`、`ORIGIN`（手填）+ `AUTH_SECRET`、`RECOVERY_TOKEN`（程序生成）+ `SETTINGS_STORE`（存哪儿） | 只在安装向导里 |
| 服务类 | 文件存储（`STORAGE_PROVIDER` + 各方案字段）、发信（`MAIL_PROVIDER` + 各方案字段） | 只在安装向导里改；非 Vercel 改完约 3 秒生效，Vercel 要重新部署 |

服务类可插拔：先选方案，再只填这个方案要的字段，没选的那套不参与也不必填。默认走最省事的那条（Vercel Blob + Resend）。它不存数据库——改乱了在服务端 `.env` 里一眼能查到、改回来。Vercel 上若选 Vercel Blob，连接 store 时勾上「Add a read-write token env var」，token 由平台自动注入，不用填。

### 环境变量一律视为机密

**所有环境变量都不安全、都不能泄露**，不分级别、没有"无所谓"的项。它们只存在服务端（`.env` 或 Vercel 环境变量），**绝对不要泄漏，也不要在任何其它地方保存**——不写进文章、注释、截图、聊天记录、公开仓库或任何在线文档，只留在服务端配置里。

涉及的全部变量：

- 身份验证与启动：`MONGODB_URI`、`MONGODB_DB_NAME`、`RP_ID`、`ORIGIN`、`AUTH_SECRET`、`RECOVERY_TOKEN`、`SETTINGS_STORE`
- 发信：`MAIL_PROVIDER`、`RESEND_API_KEY`、`RESEND_FROM`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`、`SMTP_SECURE`
- 文件存储：`STORAGE_PROVIDER`、`BLOB_READ_WRITE_TOKEN`、`S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_URL`、`LOCAL_UPLOAD_DIR`

其中 `MONGODB_URI`、`AUTH_SECRET`、`RECOVERY_TOKEN` 以及发信 / 存储的密钥类项泄漏后果最直接：能拖走整个数据库、伪造登录态、绕过两把钥匙进门、盗用发信或刷存储流量。但其余项同样不要外泄——域名、库名、方案选择这些信息拼在一起，会帮别人把站点摸清楚。

几条硬规矩：

- 已配置项在页面上**只显示「已配置」，绝不回显值**——前端看不到，也就不可能从页面源码里漏出去。
- `.env` 和 `config/*.json` 都在 `.gitignore` 里，提交前确认没有把这些文件带进去。环境变量一旦进了公开仓库，就等于已经泄漏，要立刻轮换。
- 不要把这些值发到聊天、邮件、工单里求助；真要请人排查，只描述现象，不要贴原文。
- 生成 `AUTH_SECRET` / `RECOVERY_TOKEN` 时程序只在那一次显示，当场存进密码管理器；之后服务端配置是唯一副本。

### 站点设置存在哪儿

`SETTINGS_STORE` 决定站点设置（站名、简介、社交链接、分页大小这些）放在哪儿，两个选项：

| 值 | 存在哪 | 适合谁 | 代价 |
| --- | --- | --- | --- |
| `mongodb`（默认） | 数据库的 `settings` 集合 | 大多数人 | 跟着数据库一起备份；换库要带着走 |
| `file` | 项目根目录的 `config/settings.json` | 想让站点信息独立于数据库，或想直接手改这个文件的 | 只有文件系统可写时可用（Vercel 不行）；文件不进 Git，服务器重建就丢 |

`file` 后端的实际行为：改完立即生效，不用连数据库；数据库只放文章、标签这些内容。两边的数据互相独立——站点设置不会因为数据库清空而丢。文章永远在 MongoDB 里，`file` 只管站点设置。

在安装向导第 1 步就能选。选之前程序会确认当前平台能不能写文件：Vercel 的文件系统只读，所以那边只提供 MongoDB；自部署（自有服务器 / Docker）两个都能选。选完写在 `.env` 的 `SETTINGS_STORE` 里，部署时定好，程序不猜。

切换后端不会自动搬运数据——从 `mongodb` 切到 `file` 时，站点设置会变成默认值（因为文件里还没有）；反方向同理。要保留原来的内容，先把旧地方的值抄过来。

**站点没有重置功能**，不会自动清任何配置。`config/settings.json` 是站点设置文件（不是凭据），想清空就自己删它，`SETTINGS_STORE` 想换后端就自己改 `.env`。

### 为什么没有 Global Config

Vercel 的 Storage 里还有个 Global Config（原 Edge Config），是个全球分布的 KV 存储，读起来极快。inslog 没有接它，原因是它对博客这种用法不划算：

- **写不进去**：SDK 只能读，写必须走 Vercel REST API，要一个账号级 API token、Global Config ID、Team ID 四样东西。那是能改整个 Vercel 账号的凭据，让博客作者去配它不合适。
- **改了不马上生效**：写入最多 10 秒才全球传播，改完设置刷新可能看到旧值。
- **写有配额**：免费额度每月 100 次写。

它更适合企业官网那类场景：配置由运维统一管、读多写少、变更走发布流程、团队本来就有 Vercel 管理权限。对个人博客，省下的只是一次数据库读取，代价却是把「填个连接串」变成「配四个变量并理解令牌权限」——不值得。想要快读的思路在博客这里本来就用不上：站点设置是每页读一次的小数据，不是热点数据。

## 登不上怎么办

站点**没有重置功能**。登不上（Passkey 和验证器都不在手）就用 `RECOVERY_TOKEN`——安装时程序生成、存在 `.env` / Vercel 环境变量里、请立刻存进密码管理器——从 `/login?recovery=1` 进门，进去后到设置页重新绑定 Passkey 和验证器。

这把密钥存在服务端配置里、不在数据库：能读到它就等于整站已经失守，所以不必也没必要"用后删除"，留着当长期兜底即可。只有能改服务器配置的人才是站点拥有者，别人拿到密钥也没用。真要彻底清空凭据，只能自己删数据库 `auth` 集合的 `admin` 文档（解绑验证器）、`passkeys` 集合（清空 Passkey）。

## 部署与环境变量

### 从零到能访问：完整步骤

**第一步：在 Vercel 建项目**

Vercel 控制台 → **Add New → Project** → 导入 `daveswong/inslog`。

- **Framework Preset** 选 `Next.js`（一般自动识别）
- **Root Directory** 留空（就是仓库根，别填 `src`）
- **Build Command / Output Directory** 留空，让它自动

点 **Deploy**。第一次部署不需要任何环境变量，程序会先把「站点还没配置好」那个页面显示出来——
这是**设计如此，不是部署失败**。

**首次部署要等一会儿**：域名是立刻就绑上的，构建产物要等构建完才就位。
这中间访问会看到 `404 DEPLOYMENT_NOT_FOUND`（Vercel 说"这个部署不存在"），
**不用管，等构建完成它自己就好了**。构建进度在 Deployments 页上。
要是过了几分钟还是这个错误，那才是真的失败，去看 Build Logs。

**第二步：配环境变量**

打开你项目的 `https://你的域名/setup`（**新项目这一步免登录就能进**，因为站点上还没有任何凭据）。

第 1 步会列出要填的东西：

- **MONGODB_URI** —— MongoDB 连接串。新建集群见下面「数据库和图片存储」
- **MONGODB_DB_NAME** —— 库名，可留空（默认 `inslog`，不存在会自动建）
- **RP_ID / ORIGIN** —— 你的域名，`RP_ID` 是域名主体（`inslog.example.com`），
  `ORIGIN` 是完整地址（`https://inslog.example.com`）
- **AUTH_SECRET / RECOVERY_TOKEN** —— 点「生成」程序会给出

填完点主按钮：

- **Vercel** 上文件系统是只读的，点「生成 .env 文件」下载，
  导入到 **Settings → Environment Variables**，然后**重新部署**
- **自部署** 直接写进项目根目录的 `.env`，刷新即生效

**第三步：重新部署后接着装**

环境变量生效需要一次重新部署（Vercel 上会自动触发，或者去 Deployments 点 Redeploy）。
部署完回到 `/setup`：

第 2 步填通知邮箱 → 发确认信 → **点邮件里的链接** → 落在绑 Passkey 那一步 →
绑两把钥匙（都能跳过）→ 完成 → 自动登录并进设置页。

### 第一次打开看到什么

| 你看到的 | 意思 | 怎么办 |
| --- | --- | --- |
| **「站点还没配置好 / 数据库连不上」** | 数据库还没配，**这是正常的** | 点「去安装向导」，从第 1 步填 `MONGODB_URI` |
| **首页 404** | 部署没成功，或者 Root Directory 设错了 | 先访问 `/setup`：能打开说明部署是好的（路由问题），也 404 就是构建有问题，看下面的排查表 |
| **404 `DEPLOYMENT_NOT_FOUND`** | 首次部署时构建还没完成（**多数情况，等一会儿就好**）；也可能是分支被删了 | 等构建完成；超过几分钟还这样就看 Deployments，并确认 Settings → Git 连的分支还在 |
| **Vercel 上显示部署失败（红色）** | 构建报错了 | Deployments → 点那个失败部署 → **Build Logs** 看第一行红色报错 |
| **页面正常但没有文章** | 数据库连上了，只是还没写东西 | 正常，登录后去 `/write` 写第一篇 |
| **一直跳回安装向导** | 安装最后一步没走完 | 走完向导的第 4 步「完成安装」 |

### 出问题了怎么自查

**先试这一招**：访问 `https://你的域名/setup`。

- 它能打开 → 部署是好的，问题在数据或路由
- 它也 404 → 部署本身有问题，去看 **Vercel → Deployments → 那个部署 → Build Logs**

常见的几个：

| 现象 | 多半是 | 怎么办 |
| --- | --- | --- |
| **页面显示 `404 DEPLOYMENT_NOT_FOUND`** | 域名指向了一次**不存在的部署**：这个项目一次成功的构建都没有 | Deployments 页看有没有绿色的成功部署；没有就点 **Redeploy** 触发一次；再看看 Settings → Git 里连的分支是不是已经被删了（比如 `release`） |
| 改了环境变量没反应 | 环境变量**要重新部署才生效** | Vercel → Deployments → Redeploy |
| 数据库连不上 | Atlas 的 IP 白名单 / 连接串错 | Atlas → Network Access 加 `0.0.0.0/0` 试；确认连接串里密码对 |
| 构建失败，日志提到模块找不到 | 依赖没装上 | 看 Build Logs 里的 `npm install` 那一段 |
| 构建失败，日志提到 Node 版本 | Vercel 用的 Node 版本不对 | Settings → Build & Development → Node.js Version 选 20 或 22 |
| 邮件发不出去 | 发信密钥没配，或发信域名没验证 | 检查 `RESEND_API_KEY` / `SMTP_*`；Resend 要先验证域名 |
| 图片传不上去 | 存储没配 | 检查 `STORAGE_PROVIDER` 和对应字段；Vercel Blob 要在项目里连上 store |
| Passkey 报 "RP ID 无效" | `RP_ID` 跟当前域名对不上 | 打开 `/setup`，第一步底部会显示服务器读到的 `RP_ID` / `ORIGIN` 和当前域名，按它改 |

### 数据库和图片存储得自己准备

- **MongoDB**——[MongoDB Atlas](https://www.mongodb.com/atlas) 免费额度就够用。
  建完集群，在 Network Access 里允许访问（或者 `0.0.0.0/0`），
  再建一个数据库用户，把连接串复制下来。
- **图片存储**——三种都行，Vercel Blob（最省事，在 Vercel 商店里一键装）、
  任何 S3 兼容服务（R2 / MinIO / AWS S3），或者自建服务器上的本地磁盘。

自部署：`npm run build && npm run start`，`.env` 放在项目根目录。

### 在 Vercel 上选分支（Branch Tracking）

Vercel 的每个项目有且只有一个**生产分支**（Branch Tracking）。推它 → 生产部署；
推别的分支 → 预览部署（各有一个 `xxx-git-分支名.vercel.app` 域名），**不影响正式站点**。

在 **Project Settings → Environments → Production → Branch Tracking** 里改，随时能改。

#### 让使用者的站点跟着 inslog 的正式版走

想让别人部署出来的东西始终是 inslog 的正式版（而不是某个开发中的状态），
办法是**把生产分支设成 `main`**（Branch Tracking 里选它）。`main` 分支是 inslog
每次发布时的内容，`nightly` 是开发中的东西，两者分开。

两种装法都适用：

**① Fork（推荐，保留自己的改动空间）**

在 GitHub 上 fork `daveswong/inslog`，Vercel 导入**你的 fork**。
你的 fork 里同时有 `main` 和 `nightly` 两个分支，生产分支设成 `main`。

| 发生什么 | 使用者的站点 |
| --- | --- |
| inslog 维护者推 `nightly`（开发中） | **毫无影响**。`nightly` 只是 fork 里的一个预览分支，Vercel 只会生成一个预览部署 |
| inslog 发布新版本（`main` 更新） | fork 同步之后，Vercel 自动重新部署，新内容就上去了 |

**「同步」这一步要使用者自己做一下**：GitHub 的 fork 不会自动跟着上游跑，
在 fork 首页点一下 **Sync fork**，Vercel 收到推送就自动重新部署。
不同步也没关系——站点照常跑，只是停留在部署时的那一版，拿不到新功能。

**② 直接 import inslog 仓库**

Vercel 监听的是 `daveswong/inslog` 本身，`main` 一更新就自动部署，用不着做任何同步。
代价是使用者没法往仓库里推自己的改动（没有写权限），而且维护者推 `nightly` 时，
只要生产分支是 `main`，同样不会影响使用者的站点。

#### 临时部署某个分支或某次提交

**Deployments → Create Deployment**，可以填分支名、仓库 URL
（`https://github.com/组织/仓库/tree/分支`）或具体的 commit SHA。

#### 关于 tag

本项目不打 tag，版本记录就落在 commit 历史里。Vercel 的自动部署本来也不认 tag——
想让某个 tag 触发部署得自己搭 GitHub Actions（官方指南叫
"Can you deploy based on tags/releases on Vercel?"），要先关掉自动部署再手动调 CLI。
用 `main` 分支就够。

数据库连接串是通用的：Atlas、自建、Railway、容器里的 MongoDB 都行。库名优先级 `MONGODB_DB_NAME` > 连接串路径里的名字 > `inslog`；同一集群跑多个站点时用不同库名区分，填一个不存在的库名，安装向导会自动建出来。

**inslog 只用 MongoDB**，不兼容 Postgres / Redis 那一类——数据层是 MongoDB 原生驱动加聚合管道（置顶排序、时间线排序都靠 `$ifNull` 补字段），换库等于重写数据层，不是换个连接串的事。

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
| `RP_ID` | Passkey 域名主体，如 `inslog.example.com`，**必须与正式域名一致** |
| `ORIGIN` | 站点完整地址，如 `https://inslog.example.com`，确认邮件链接按它拼 |
| `SETTINGS_STORE` | 站点设置存哪儿：`mongodb`（默认）或 `file`。部署时定，见上一节 |
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

inslog 的图片是**浏览器直传**的（要生成给前端的 client token），这正是官方说明里需要长期令牌的那两种情况之一，所以连接时要**勾上这个开关**。不勾的话图片插不进去。两种凭据都在环境变量里，程序不需要用户手动抄。

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
    setup/                    # 首次安装向导（配环境变量 + 检查）
    confirm/[token]/          # 邮件确认页（凭据变更真正生效的地方）
    uploads/[...path]/        # 本地存储方案下的文件回读（图片与附件）
    not-found.tsx             # 自定义 404
    rss.xml/  sitemap.xml/  robots.txt/
    api/                      # auth/*（passkey、totp、recovery、logout）、setup/*、upload*（三套存储）、diag
  components/                 # BlockEditor、PostBody、AttachmentList、SiteFooter、WriteFab、
                               # i18n-provider、install-hint、service-config-fields
  lib/                         # mongodb / posts / settings / settings-file / auth / session / passkey / totp /
                               # secret-box / pending / change-request / env-store / env-config / service-config /
                               # storage / upload-client / attachment-url / mail / rate-limit / site-url /
                               # safe-path / i18n-core / image-compress …
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
git clone https://github.com/daveswong/inslog.git
cd inslog
npm install
npm run dev
```

改动走 `nightly`，测通了再发到 `main`。发布由维护者用一条命令完成：

```bash
npm run release
```

它只做一件事：把 `nightly` 的内容 force push 到 `main`。不打 tag，也不建 GitHub Release——
版本记录就落在 commit 历史里。`main` 是 `nightly` 的镜像，不接受直接提交：
要改东西就在 `nightly` 上改，测通了再发布。

**提交信息用中文短句**，说清做了什么就行，不用套 Conventional Commits。
