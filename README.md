# inslug

一个极简的个人技术博客，单用户自用。基于 Next.js（App Router）+ React + TypeScript + Bootstrap，数据存 MongoDB Atlas，部署在 Vercel。

前端风格：极简单栏、文字驱动，无摘要/封面/卡片，专注编程与电路技术内容。

## 当前状态

读写闭环可用：首页 / 详情 / 搜索 / 写作全部读数据库，文章可在编辑器里写并保存。登录用 Passkey（WebAuthn）或手机验证器（TOTP，扫码绑定、6 位码登录），**没有密码**；middleware 保护写文章与站点设置。站点设置（基本信息 / SEO / 社交 / 分页 / 页脚 / 通知邮箱）、图片直传 Vercel Blob、SEO 元信息都已完成。更换 / 解绑验证器需要邮件二次确认。

尚未做：自定义 404、RSS。

## 本地运行

```bash
npm install

# 1. 数据库连接
cp config/database.example.json config/database.json
# 编辑 config/database.json，把 uri 换成你的 MongoDB Atlas 连接串

# 2. 会话密钥
cp .env.example .env.local
# 生成一串随机值填进 AUTH_SECRET：openssl rand -base64 32

# 3. 紧急入口密钥（可选，但强烈建议）
# 在 .env.local 里加 RECOVERY_TOKEN="$(openssl rand -base64 32)"
# 两把钥匙都丢了时用它进门：/login?recovery=1

# 4. 图片上传（可选，不配也能写文章，只是不能插图）
# 在 .env.local 加 BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
# token 来自 Vercel → Storage → 新建 Blob store（必须是 Public）时勾选
# "Add a read-write token env var to this connection"

npm run dev
```

打开 http://localhost:3000

> `config/database.json` 和 `.env.local` 含连接串与密钥，已被 `.gitignore` 忽略，**切勿提交到 GitHub**。

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

## 界面语言

界面文案（按钮、提示、错误）支持中文 / 英文，**文章内容不翻译**。语言包在 `locales/zh-CN.json` 与 `locales/en.json`，键就是中文原文；缺翻译时自动回退到中文。

切换只改一个开关：

- 本地：`cp config/locale.example.json config/locale.json`，把 `locale` 改成 `"en"` 或 `"zh-CN"`
- Vercel：加环境变量 `UI_LANGUAGE=en`（**优先级高于本地文件**）

改完重新构建 / 部署生效。想加新语言就复制一份 `locales/en.json` 改成对应语言，再把开关指向新文件名（同时要在 `SUPPORTED_LOCALES` 里登记）。

## 环境变量与部署

本地需要的配置都在 `config/database.json` 和 `.env.local`（两者都不提交），详见 `.env.example`。

Vercel 部署需要在 Project → Settings → Environment Variables 配置：

| 变量 | 说明 |
| --- | --- |
| `MONGODB_URI` | Atlas 连接串（代码优先用环境变量，本地才读 `config/database.json`） |
| `AUTH_SECRET` | 会话签名密钥 + 加密验证器 secret 的密钥，`openssl rand -base64 32`（换掉会让已绑定的验证器失效） |
| `RECOVERY_TOKEN` | 紧急入口密钥，≥16 字符，`openssl rand -base64 32`。**平时不设**，只在需要救急时加上 |
| `RP_ID` | Passkey 依赖的域名主体，如 `inslug.example.com`（**必须与正式域名一致**，改域名会导致已绑定的 Passkey 失效） |
| `ORIGIN` | 站点地址，如 `https://inslug.example.com` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 读写令牌；store 必须是 **Public**（创建后不可改），否则正文图片读者看不到 |
| `RESEND_API_KEY` | Resend 的 API key，用于发送「更换 / 解绑验证器」的确认邮件 |
| `RESEND_FROM` | 发件人，形如 `inslug <no-reply@你的域名>`；域名需先在 Resend 验证（加 SPF/DKIM 记录） |
| `UI_LANGUAGE` | 界面语言，`zh-CN` 或 `en`；不填走本地 `config/locale.json`，再不填默认中文 |

> **换绑 / 解绑验证器**：登录后到 `/settings` 的「登录」一节，提交后会往「通知邮箱」发一封确认信，点开链接再确认一次才生效。生效后所有设备都需要重新登录。
> 邮件相关的三个条件（`RESEND_API_KEY`、`RESEND_FROM`、设置页的通知邮箱）缺任一，这两个操作就会被禁用（首次绑定不受影响）。
>
> **两把钥匙都丢了**（手机换了、Passkey 设备不在手上）：Vercel 里加 `RECOVERY_TOKEN` → 重新部署 → 打开 `/login?recovery=1` 粘贴密钥进去 → 在设置页重新绑定验证器 → 回 Vercel 删掉这个变量。
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
