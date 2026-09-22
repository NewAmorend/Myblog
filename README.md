# Amorend 个人博客

以阅读为中心的静态博客，记录 AI、工程实践与学习笔记。前台采用原生 HTML、CSS 和 JavaScript。

## 页面与资源

- `index.html`：简短个人简介、系列与文章入口，无顶部导航和文章预览。
- `blog.html`：独立文章、搜索和分类筛选。
- `series.html`：系列列表，以及通过 `?series=<id>` 打开的系列简介和有序目录。
- `article.html`：共用正文排版；系列章节显示章节导航，独立文章显示简化目录。
- `assets/site.css`：浅色与深色阅读主题、响应式排版。
- `assets/site.js`：内容加载、筛选与导航。
- `i18n.js`：中英界面字典与语言切换。
- `blog/`：全部正文和元数据索引，包括系列章节。
- `series/index.json`：系列介绍和手动编排的章节顺序。
- `admin/`、`api/admin/`：写作后台和管理接口，需单独配置部署。

## 核心体验

- 全站黑白灰，以文字、留白和细分隔线组织内容；首页只提供 bio 与阅读入口。
- 系列入口 → 系列简介和目录 → 章节；章节顺序由作者编排，上一章和下一章不会跳出系列。
- 文章入口只列出独立文章，按发布时间排序；返回列表保留搜索和分类条件。
- 内页提供统一导航，点击网站名回到首页；手机端章节目录默认折叠。
- 中英切换保留当前系列和章节，缺少正文译文时提示并保留原文。语言、明暗主题会跨页保存。
- 正常链接保留浏览器前进、后退和新标签页能力，不添加装饰动画。
- Markdown 由本地 Marked 解析并经 DOMPurify 净化，数学公式使用本地 MathJax。

系列编排见 [WRITING.md](WRITING.md#组织一个系列)。当前正式文章和系列索引均为空。

## 本机写作后台（当前使用方式）

双击仓库里的 `启动写作后台.command`，保持终端窗口打开，访问 `http://127.0.0.1:4317/admin/`。也可以在项目目录执行 `npm run admin`。

- 使用 `.env.local` 中现有的后台密码和会话密钥，文件不进入版本控制。
- 草稿、会话与登录限速保存在 `.blog-admin/local.sqlite`，重启后保留。备份时先关闭后台，再复制整个 `.blog-admin/` 目录到私人备份位置。
- 仅监听本机回环地址，拒绝其他主机名和跨站请求，不需要 Redis 或 Vercel。
- 复用 `gh auth login` 登录的 GitHub 账户；凭据只在进程内读取，不写回配置或发送给浏览器。
- 读取已发布文章、发布、下线和上传图片需要联网。发布和上传会立即提交到 GitHub，触发现有博客部署；保存草稿不会公开内容。
- 关闭终端中的服务不会影响已经上线的博客。终端按 `Ctrl+C` 关闭。
- 静态文件服务只开放 `admin/` 和 `assets/`，私有配置、数据库及源码接口文件不可下载。

后台的系列编排仍按 WRITING.md 编辑 `series/index.json`；这一版本的后台编辑器管理单篇正文。

## 本地运行

```bash
python3 -m http.server 4173
```

然后访问：

```text
http://localhost:4173/
```

不要直接用文件协议打开页面，因为博客列表和文章内容依赖 `fetch()` 读取本地 JSON/Markdown 文件。

## 添加博客文章

日常发布优先访问 `/admin/` 使用写作后台。后台支持草稿、Markdown 分栏预览、图片上传、发布更新与文章下线；草稿保存在私有 Redis 中，发布、下线和图片上传才会形成 Git 提交，因此不改变现有静态前台的数据结构。

首次部署配置见下方“写作后台部署”。命令行发布方式仍然保留，适合批量导入或自动化。

### 命令行方式

1. 在 `blog/` 下新增 Markdown 文件，并写入 frontmatter。
2. 在 `blog/index.json` 中添加对应条目：

```json
{
  "id": "your-post-id",
  "file": "your-post.md",
  "title": "文章标题",
  "date": "2026-06-01",
  "tag": "AI",
  "excerpt": "文章摘要"
}
```

3. 访问 `article.html?post=your-post-id` 检查渲染效果。

双语正文的文件格式与发布步骤见 [WRITING.md](WRITING.md#双语文章)。

## 部署

公开站点由 `.github/workflows/deploy-pages.yml` 构建并只发布 `dist/`。`admin/`、`api/`、本机启动脚本与私有数据均不进入公开输出；本机后台直接读取仓库中的 `admin/`。不要把 GitHub Pages 发布来源改回仓库根目录。Marked、DOMPurify 和 MathJax 已固定版本并随站点发布。升级时运行 `npm ci`、`npm run vendor` 和 `npm test`，检查 `assets/vendor/manifest.json` 后一并提交依赖锁文件与生成资源。开发和测试需要符合 package.json 要求的 Node.js 版本。

### 写作后台部署

静态前台可以部署在任何平台，但 `/api/admin/*` 需要 Vercel Functions。要启用后台：

1. 在 GitHub 创建一个仅授权本仓库的 fine-grained token，授予 `Contents: Read and write`。
2. 在 Vercel 项目中配置 `BLOG_ADMIN_PASSWORD`、`BLOG_ADMIN_SECRET`、`BLOG_GITHUB_TOKEN`、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` 和独立的 `BLOG_STORAGE_NAMESPACE`；完整示例见 `.env.example`。
3. 确认 Vercel 项目关联 `NewAmorend/Myblog`，生产分支为 `main`，然后重新部署。
4. 访问 `https://你的域名/admin/` 登录。

后台不会把 GitHub 或 Redis token 发送给浏览器。登录状态使用 8 小时有效的 HttpOnly Cookie，写操作会验证完整同源来源与 CSRF token。退出会撤销服务端会话，修改密码或签名密钥会使旧会话失效。单管理员账户每 15 分钟最多接受 10 次登录尝试，成功登录也计数；达到上限后自动等待窗口过期，分布式请求无法通过更换 IP 绕过。私有存储故障时后台拒绝继续操作。

草稿只保存在私有 Redis，不再写入 Git。发布成功后才清理对应草稿版本，另一个窗口保存的新版本会保留。旧版 `.blog-admin/drafts.json` 不会自动导入或删除；若存在，应先安全备份并迁移到私有存储，再处理公开仓库及历史中的敏感内容。为 Redis 启用备份，避免数据库删除或过期策略造成草稿丢失。

前台 HTML 内置 CSP，适用于 GitHub Pages；Vercel 同时配置了响应头。主域名走 Cloudflare 时，仍须在该域名的 SSL/TLS 设置启用 **Always Use HTTPS**，核实源站证书后使用 **Full (strict)**，再开启 HSTS（初期不包含子域）。HTML 中的 CSP 不能代替服务器的 HTTP → HTTPS 重定向。GitHub Pages 本身不会读取 `vercel.json`。

本地调试后台需要让 Functions 一起运行：

```bash
cp .env.example .env.local
npx vercel dev
```

不要提交 `.env.local`；仓库已经通过 `.gitignore` 排除它。
