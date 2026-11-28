# inslog

[![npm version](https://img.shields.io/npm/v/@insapp-dev/inslog)](https://www.npmjs.com/package/@insapp-dev/inslog)

一个基于 Node.js + Next.js 的 Blog APP：让作者专注于写作，让读者专注于阅读。

**路径短、界面干净、默认安全。** 单用户、单站点、纯自用；没有账号系统、密码、追踪、评论、推荐算法、弹窗和花哨装饰。不做多用户、后台、社交、统计，也没有主题模板。

**归属权在你手里。** 内容在 MongoDB，文件在 Vercel Blob / S3 / 本地磁盘，邮件走 Resend / SMTP。服务可换，配置由你自己保存。公开部署需在页脚保留源码链接。

安装：`npm i @insapp-dev/inslog`

## 能做什么

- 首页时间线：日期 + 标题，支持搜索、标签、分页；公开文章 6 个月内标 `new`，置顶只调排序。
- 文章：草稿 / 私有 / 公开三态；访客只读公开内容，草稿和私有直接访问 404。
- 编辑器：BlockNote，支持标题、列表、引用、代码块、表格、图片，以及文件 / 音频 / 视频块。
- 标签与地址：标签手动创建，没人引用就删；slug 自动生成，也可自己填。
- 登录：Passkey 主，TOTP 辅；两把钥匙都丢了用 `RECOVERY_TOKEN`。凭据变更走一次性邮件确认。
- 设置：站点信息、SEO、外观、每页文章数、社交链接；主题和界面语言即时生效。
- 输出：RSS、sitemap、robots.txt、自定义 404；只输出公开文章。

## 部署

推荐 Vercel：把 Production Branch / Branch Tracking 设为 `main`，避免推 `nightly` 影响正式站点。

1. 导入 `daveswong/inslog`，Framework Preset 选 Next.js，根目录留空，Deploy。
2. 打开 `/setup`，填数据库地址、库名、`RP_ID`、`ORIGIN`，选发信 / 存储方案，点「生成 .env 文件」。
3. 把下载的 `.env` 导入 Vercel 环境变量，重新部署；库名必须明确，`AUTH_SECRET` 和 `RECOVERY_TOKEN` 自动生成、页面不显示。
4. 回 `/setup` 点「检查配置，完成安装」，通过后跳登录页。
5. 用 `RECOVERY_TOKEN` 从 `/login?recovery=1` 登录，到设置页填通知邮箱、绑 Passkey 和 TOTP。

自部署：把 `.env` 放到项目根目录，`npm run build && npm run start`，重启服务。非 Vercel 可使用本地文件存储；Vercel 只能用 MongoDB 存设置。

**程序不会写服务器环境变量。** 所有环境变量都是机密，只放服务端 `.env` / 平台后台，不进文章、截图、聊天或公开仓库。站点没有重置流程；恢复密钥用完后建议自行删除，不删也不报错。

MongoDB 库名必须明确：`MONGODB_DB_NAME` 或连接串路径；填一个不存在的库名会自动创建。Vercel 上 Atlas 白名单需放开 `0.0.0.0/0`。

`NEXT_PUBLIC_SITE_URL` 可选，不填回退 `ORIGIN`；`SETTINGS_STORE` 可选 `mongodb` / `file`；界面语言在设置页切换。

## 本地开发

```bash
npm install
npm run dev
```

常用命令：

```bash
node scripts/test-connection.mjs  # 只读连通测试
node scripts/seed-demo.mjs        # 演示数据
npm run backup                    # 导出文章 / 标签 / 设置，不导出凭据
npx tsc --noEmit
npm run build
```

仓库无 test / lint 脚本，验收以上述命令加具体行为核对为准。

## 参与开发

- 改动走 `nightly`，测通后再同步 `main`；`main` 是发布分支，推之前要单独确认。
- 发布命令：`npm run release`（force push nightly → main，不打 tag、不建 GitHub Release）。
- 提交信息用中文短句，说清做了什么即可。
- 代码注释用中文，文件编码 UTF-8。
- 改界面文案同步 `locales/en.json`；缺翻译回退中文。
- 不引入主题模板 / 外观预设；不过度设计。

## 协议

MIT License，附加要求：公开部署必须在页脚保留指向源码仓库的可见链接，链接固定在 `src/components/SiteFooter.tsx`，不进设置。
