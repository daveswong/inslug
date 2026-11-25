# inslog

一个自己用的博客。程序只是程序——它只做一件事：让你安静地写、存、传自己的内容。

**路径短、界面干净、默认安全。** 没有账号系统，没有密码，没有追踪，没有评论，没有推荐算法，
没有弹窗和花哨的装饰。那些烦人的东西离使用者远一点，人才有心思专注在创作本身。

**归属权在你手里。** 内容存在你自己挑的 MongoDB 里，图片放在你自己挑的对象存储里，
邮件走你自己挑的通道。**推荐用 Vercel 部署**——导入仓库、配几个变量就完事，是最省事的路子；
但程序不绑死任何一家：自有服务器、Docker、任何能跑 Node 的地方都能装。
数据库、图片存储、邮件都是可插拔的，换一家只是改一个变量。

**边界很清楚。** 它是一个单用户、单站点、纯自用的写作工具。不做多用户、不做后台、
不做社交、不做统计。想让别人访问你的文字，那就把文章发布出去；除此之外，它不替你做任何决定。

## 当前状态

读写闭环可用：首页 / 详情 / 搜索 / 写作全部读数据库，文章可在编辑器里写并保存。登录用 Passkey（WebAuthn）或手机验证器（TOTP，扫码绑定、6 位码登录），**没有密码**；middleware 保护写文章与站点设置。站点设置（基本信息 / SEO / 社交 / 分页 / 页脚 / 通知邮箱）、图片直传 Vercel Blob、SEO 元信息都已完成。更换 / 解绑验证器需要邮件二次确认。

尚未做：自定义 404、RSS。

## 本地运行

```bash
npm install

# 1. 数据库连接
cp config/database.example.json config/database.json
# 编辑 config/database.json，把 uri 换成你的 MongoDB 连接串（Atlas、自建、Railway 都行）

# 2. 会话密钥
cp .env.example .env.local
# 生成一串随机值填进 AUTH_SECRET：openssl rand -base64 32

# 3. 紧急入口密钥（可选，但强烈建议）
# 在 .env.local 里加 RECOVERY_TOKEN="$(openssl rand -base64 32)"
# 两把钥匙都丢了时用它进门：/login?recovery=1

# 4. 图片上传（可选，不配也能写文章，只是不能插图）
# 装好之后到 /settings 的「邮件与图片存储」里选方案并填凭据：
#   vercel-blob —— BLOB_READ_WRITE_TOKEN（Vercel → Storage → 新建 Blob store，必须 Public）
#   s3          —— S3_* 六个变量
#   local       —— 无需凭据，写到 uploads/ 目录
# 发信同理：resend 用 RESEND_API_KEY / RESEND_FROM，smtp 用 SMTP_* 六个变量

npm run dev
```

打开 http://localhost:3000

> `config/database.json` 和 `.env.local` 含连接串与密钥，已被 `.gitignore` 忽略，**切勿提交到 GitHub**。
> `config/` 下所有非 `.example.json` 的文件、`uploads/`、`.env*` 都在忽略列表里——凡是要你自己创建或上传的东西，都不会进仓库。

连通性检查（只读，不写数据）：

```bash
node scripts/test-connection.mjs       # ping + 列出集合
```

> 若连接报 `SSL alert internal error`，多为 Atlas 的 IP 白名单问题：到 Atlas → Network Access 添加当前出口 IP。

演示数据（与项目本身相关的几篇文章，可重复执行重灌）：

```bash
node scripts/seed-demo.mjs
```

## 目录结构

```
src/
  app/
    page.tsx            # 首页：站点信息 + 搜索 + 标签 + 文章时间线
    posts/[slug]/       # 文章详情
    search/             # 站内搜索
    write/              # 写作页（server action 保存到库）
    login/              # 登录（Passkey / 验证器 6 位码 / 紧急入口）
    settings/           # 站点设置：站点信息表单 + Passkey 管理 + 验证器绑定
    confirm/[token]/    # 邮件确认页（验证器变更生效处）
    api/auth/           # Passkey、验证码、紧急入口、退出的接口
  components/           # BlockEditor（编辑）、PostBody（只读正文）、WriteFab、SiteFooter
  lib/                  # mongodb / posts / settings / auth / session / passkey / totp / secret-box / post-utils
  middleware.ts         # 保护 /write 与 /settings
config/
  database.example.json # 数据库配置模板（提交仓库）
  database.json         # 本地实际配置（gitignore）
scripts/
  test-connection.mjs   # 只读连通测试
  seed-demo.mjs         # 演示数据
```

## 技术方案（已确认）

- 首页区块顺序：站点名 → 简介 → 站内搜索 → 标签目录 → 更新列表（仅日期+标题、分页，无摘要/封面）→ 社媒链接（有才显示）→ 页脚
- 编辑器：BlockNote，类 Notion 所见即所得，仅排版类块（标题分级、文字格式、列表、引用/代码、分割线/表格、对齐、图片），不含待办/折叠
- 图片：上传到 Vercel Blob，数据库只存 URL
- tag：手动创建+选择，未被使用的自动删除
- 可见性：三态 `draft`（草稿）/ `private`（私有，访客不可见）/ `public`（公开）；访客只读公开文章，私有/草稿直接访问也拦截
- 发布日期距今不超过 6 个月的文章显示 `new` 标记
- 搜索：匹配标题+正文+tag
- 登录：Passkey（WebAuthn）为主，手机验证器（TOTP）为辅，**不设密码**；middleware 保护写文章、设置与安装向导
- 验证器：扫码绑定，6 位码登录（30 秒一步，窗口 ±1，同一步的码不能复用）；secret 以 AES-256-GCM 加密后落库
- 验证器变更：首次绑定直接生效；**更换 / 解绑必须过邮件确认**（这两件事会让已有钥匙失效）
- 应急：两把钥匙都丢了走 `/login?recovery=1` + `RECOVERY_TOKEN` 环境变量
- 站点设置：基本信息、SEO、社交链接、favicon/页脚、分页大小
- 不做：用户系统、独立后台、评论

## 首次安装与恢复引导

- `/setup`（**需登录**）：四步向导 —— 站点信息（站名 / 简介 / 分页 / 通知邮箱）→ 绑 Passkey → 绑手机验证器 → 完成。完成后写 `settings.setupCompleted = true`，之后从登录页进首页不再自动改道。向导复用设置页的两个绑定组件，绑完会刷新状态。
- `/reset`（公开）：未登录只显示**通用恢复步骤**，不泄露任何状态；登录后显示 Passkey 数量、验证器是否绑定、邮件确认是否可用、紧急密钥是否配置（只看存在与否，不显示值），并按实际情况列出下一步。
- **密钥类变量不在网页里填**：`MONGODB_URI`、`AUTH_SECRET`、`RECOVERY_TOKEN`、Resend key 都只能配在 Vercel 服务端。网页里填这些等于直接公开，且 Vercel 环境变量本来也无法由运行时写入。
- 完全丢失凭据的兜底：删 `auth` 集合的 `admin` 文档解绑验证器，删 `passkeys` 集合清空 Passkey，然后从 `/setup` 重来。

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

## 服务器配置怎么配

配置分成两组，存储位置和修改时机都不一样：

| 组 | 内容 | 存哪 | 什么时候能改 |
| --- | --- | --- | --- |
| 身份验证与启动 | `MONGODB_URI`、`MONGODB_DB_NAME`、`AUTH_SECRET`、`RECOVERY_TOKEN`、`RP_ID`、`ORIGIN` | 非 Vercel：项目根目录的 `.env` 文件（部署时生成，不在 Git 里）；Vercel：项目环境变量 | 只在**安装 / 重置引导**里改 |
| 服务类 | 图片存储（`STORAGE_PROVIDER` + 各方案字段）、发信（`MAIL_PROVIDER` + 各方案字段） | 数据库 | 部署之后在设置页随时改，不用重新部署 |

服务类这两项是**可插拔的**：先选方案（vercel-blob / s3 / local，resend / smtp），再只填这个方案要的字段。
没选的那套不参与，也不必填。默认走最省事的那条（Vercel Blob + Resend）。

引导入口：

- 站点没初始化时打开 `/setup`，第一步就是配这些。**这一步免登录**——新部署可能连数据库都还没配，除此之外没有别的入口。
- 要把配置推倒重来，去 `/reset` 的「重置配置」：**会发确认邮件**，点邮件里的链接再点一次确认才会生效。

重置的边界：

| 会清掉 | 不会动 |
| --- | --- |
| 数据库里存的邮件 / 图片存储凭据 | 站点设置（站名、SEO、社交链接、分页…） |
| `.env` 文件里的数据库地址、库名、会话密钥、紧急密钥、域名、站点地址 | 文章与标签 |
| | 已绑定的 Passkey 与手机验证器 |

平台改不掉的（Vercel 的环境变量）会在确认后的页面上**逐个列出来**，由你手动去控制台删除。

平台差异：

- **Vercel**：文件系统只读，写不了 `.env`。引导页会列出需要填的变量清单，你自己到项目环境变量里填。
- **自有服务器 / Docker**：引导页直接写 `.env` 文件，写完刷新即生效，不用重启。

> `AUTH_SECRET` 改了会让所有设备掉线、已绑定的验证器也要重新绑；`MONGODB_URI` 改了会立刻重连数据库，页面可能短暂打不开。

## 界面语言

界面文案（按钮、提示、错误）支持中文 / 英文，**文章内容不翻译**。语言包在 `locales/zh-CN.json` 与 `locales/en.json`，键就是中文原文；缺翻译时自动回退到中文。

**日常切换：在站点设置 →「外观」→「界面语言」里点「中文 / English」，立刻生效**，不用改环境变量、不用重新部署。语言是站点级的，所有人看到的都是这个语言。

下面两处只在部署时定默认值，平时用不到：

- 本地：`cp config/locale.example.json config/locale.json`，把 `locale` 改成 `"en"` 或 `"zh-CN"`
- Vercel：加环境变量 `UI_LANGUAGE=en`

取值只有 `zh-CN`（中文）和 `en`（英文）两个，界面上直接显示「中文 / English」，不用记代码。

改完重新构建 / 部署生效。想加新语言就复制一份 `locales/en.json` 改成对应语言，再把开关指向新文件名（同时要在 `SUPPORTED_LOCALES` 里登记）。

## 环境变量与部署

本地需要的配置都在 `config/database.json` 和 `.env.local`（两者都不提交），详见 `.env.example`。

### 一定要在部署时给的

| 变量 | 说明 |
| --- | --- |
| `MONGODB_URI` | MongoDB 连接串。**任何 MongoDB 都行**：Atlas、自建、Railway、容器里的都行（代码优先用环境变量，本地才读 `config/database.json`） |
| `MONGODB_DB_NAME` | 库名。留空用连接串路径里的名字，再没有就是 `inslog`。同一个集群跑多个站点时用不同库名区分；填一个不存在的库名，安装向导会自动建出来 |
| `AUTH_SECRET` | 会话签名密钥 + 加密验证器 secret 的密钥，`openssl rand -base64 32`（换掉会让已绑定的验证器失效） |
| `RECOVERY_TOKEN` | 紧急入口密钥，≥16 字符，`openssl rand -base64 32`。**建议长期留着**，它是你唯一能进门的路 |
| `RP_ID` | Passkey 依赖的域名主体，如 `inslog.example.com`（**必须与正式域名一致**，改域名会导致已绑定的 Passkey 失效） |
| `ORIGIN` | 站点地址，如 `https://inslog.example.com` |
| `NEXT_PUBLIC_SITE_URL` | 站点地址，用于 canonical / 分享图 / RSS |

### 图片存储（选一个）

在设置页 →「邮件与图片存储」里改，存数据库，不用重新部署。

| 方案 | 需要什么 |
| --- | --- |
| `vercel-blob`（Vercel 部署最省事） | `BLOB_READ_WRITE_TOKEN`。store 必须是 **Public**（创建后不可改），否则正文图片读者看不到 |
| `s3`（R2 / MinIO / AWS S3 / OSS…） | `S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_URL`。桶要允许匿名读取 |
| `local`（自建服务器） | `LOCAL_UPLOAD_DIR`，默认 `uploads`，目录要可写；多实例部署需要共享这个目录 |

### 发信（选一个）

| 方案 | 需要什么 |
| --- | --- |
| `resend` | `RESEND_API_KEY`、`RESEND_FROM`。域名要先在 Resend 验证（加 SPF/DKIM 记录） |
| `smtp` | `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`、`SMTP_SECURE`。QQ / Gmail 要用授权码，不是登录密码 |

> **换绑 / 解绑验证器**：登录后到 `/settings` 的「登录」一节，提交后会往「通知邮箱」发一封确认信，点开链接再确认一次才生效。生效后所有设备都需要重新登录。
> 发信没配好（或通知邮箱为空）时，这两个操作就会被禁用（首次绑定不受影响）。
>
> **两把钥匙都丢了**（手机换了、Passkey 设备不在手上）：部署环境里加 `RECOVERY_TOKEN` → 重新部署 → 打开 `/login?recovery=1` 粘贴密钥进去 → 在设置页重新绑定验证器。
> 实在不行还可以直接删掉数据库 `auth` 集合里那条文档，让验证器回到「未绑定」状态。

**前端不提供任何数据库或凭据配置入口**（连接串和密钥放前端会泄露）。

部署步骤：

1. GitHub 建仓库并推送代码（确认 `config/database.json`、`.env.local` 未被提交）
2. Vercel 导入该仓库，框架自动识别为 Next.js
3. 配好上表中的环境变量
4. 部署完成后绑定域名；域名 DNS 托管在 Vercel 时，HTTPS 证书自动签发
5. 首次进入：用 Passkey 登录（或先用 `RECOVERY_TOKEN` 进门）→ 到 `/settings` 的「登录」一节绑定这台设备的 Passkey，再扫一次码绑上手机验证器，之后两把钥匙都能进
6. 未来部署演示站：把 `MONGODB_URI` 换成演示库连接串

## 开源协议

本项目采用 [MIT License](./LICENSE)，并附加一条要求：**任何公开部署都必须保留指向本项目源码仓库的可见链接**，让更多人能找到并使用它。该链接位于页脚，独立于站点自己的内容与社媒链接，也不在站点设置中修改。

> 链接位置在 `src/components/SiteFooter.tsx`，全站共用，改一处即可。
