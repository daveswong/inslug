# inslug

一个极简的个人技术博客，单用户自用。基于 Next.js（App Router）+ React + TypeScript + Bootstrap，数据存 MongoDB Atlas，部署在 Vercel。

前端风格：极简单栏、文字驱动，无摘要/封面/卡片，专注编程与电路技术内容。

## 当前状态

读写闭环可用：首页 / 详情 / 搜索 / 写作全部读数据库，文章可在编辑器里写并保存。登录用 Passkey（WebAuthn）+ 后备密码，中间件保护写文章与站点设置。站点设置（基本信息 / SEO / 社交 / 分页 / 页脚）、图片直传 Vercel Blob、SEO 元信息都已完成。

尚未做：凭据修改（改密码 / 改 Passkey）的邮件二次确认、自定义 404、RSS。

## 本地运行

```bash
npm install

# 1. 数据库连接
cp config/database.example.json config/database.json
# 编辑 config/database.json，把 uri 换成你的 MongoDB Atlas 连接串

# 2. 会话密钥
cp .env.example .env.local
# 生成一串随机值填进 AUTH_SECRET：openssl rand -base64 32

# 3. 后备密码
npm run hash-password -- 你的密码
# 把输出的哈希粘进 config/auth.json 的 passwordHash（见 config/auth.example.json）

# 4. 图片上传（可选，不配也能写文章，只是不能插图）
# 在 .env.local 加 BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
# token 来自 Vercel → Storage → 新建 Blob store（必须是 Public）时勾选
# "Add a read-write token env var to this connection"

npm run dev
```

打开 http://localhost:3000

> `config/database.json` 和 `config/auth.json` 含密码信息，已被 `.gitignore` 忽略，**切勿提交到 GitHub**。

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
    login/              # 登录（Passkey / 密码）
    settings/           # 站点设置：站点信息表单 + Passkey 管理
    api/auth/           # 登录、Passkey、退出的接口
  components/           # BlockEditor（编辑）、PostBody（只读正文）、WriteFab、SiteFooter
  lib/                  # mongodb / posts / settings / auth / session / passkey / post-utils
  middleware.ts         # 保护 /write 与 /settings
config/
  database.example.json # 数据库配置模板（提交仓库）
  database.json         # 本地实际配置（gitignore）
  auth.example.json     # 后备密码哈希模板（提交仓库）
  auth.json             # 本地密码哈希（gitignore）
scripts/
  test-connection.mjs   # 只读连通测试
  hash-password.mjs     # 生成后备密码的 bcrypt 哈希
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
- 登录：主用 Passkey（WebAuthn），密码（哈希+限速）作为后备；middleware 只保护写文章与设置
- 站点设置：基本信息、SEO、社交链接、favicon/页脚、分页大小
- 不做：用户系统、独立后台、评论

## 环境变量与部署

本地需要的配置都在 `config/database.json`、`config/auth.json` 和 `.env.local`（三者都不提交），详见 `.env.example`。

Vercel 部署需要在 Project → Settings → Environment Variables 配置：

| 变量 | 说明 |
| --- | --- |
| `MONGODB_URI` | Atlas 连接串（代码优先用环境变量，本地才读 `config/database.json`） |
| `AUTH_SECRET` | 会话签名密钥，`openssl rand -base64 32` |
| `ADMIN_PASSWORD_HASH` | 后备密码哈希，`npm run hash-password -- 你的密码` 的输出（Vercel 里直接粘原文，不需要转义） |
| `RP_ID` | Passkey 依赖的域名主体，如 `inslug.example.com`（**必须与正式域名一致**，改域名会导致已绑定的 Passkey 失效） |
| `ORIGIN` | 站点地址，如 `https://inslug.example.com` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 读写令牌；store 必须是 **Public**（创建后不可改），否则正文图片读者看不到 |

> 忘记后备密码：重新跑一次 `npm run hash-password`，替换 `ADMIN_PASSWORD_HASH` 后重新部署即可；已绑定的 Passkey 不受影响。

**前端不提供任何数据库或密码配置入口**（连接串和哈希放前端会泄露）。

部署步骤：

1. GitHub 建仓库并推送代码（确认 `config/database.json`、`config/auth.json` 未被提交）
2. Vercel 导入该仓库，框架自动识别为 Next.js
3. 配好上表中的环境变量
4. 部署完成后绑定域名；域名 DNS 托管在 Vercel 时，HTTPS 证书自动签发
5. 首次登录：用密码登录 → 到 `/settings` 的「登录」一节绑定这台设备的 Passkey，之后就能用 Face ID / 指纹登录
6. 未来部署演示站：把 `MONGODB_URI` 换成演示库连接串

## 开源协议

本项目采用 [MIT License](./LICENSE)，并附加一条要求：**任何公开部署都必须保留指向本项目源码仓库的可见链接**，让更多人能找到并使用它。该链接位于页脚，独立于站点自己的内容与社媒链接，也不在站点设置中修改。

> 链接位置在 `src/components/SiteFooter.tsx`，全站共用，改一处即可。
