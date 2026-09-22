# Amorend 个人博客

以阅读为中心的静态博客，记录 AI、工程实践与学习笔记。前台采用原生 HTML、CSS 和 JavaScript。

## 页面与资源

- `index.html`：博客介绍、最近文章和主题概览。
- `blog.html`：全部文章、搜索和分类筛选。
- `article.html`：Markdown 正文、目录、相邻文章与返回列表。
- `assets/site.css`：浅色与深色阅读主题、响应式排版和页面过渡。
- `assets/site.js`：内容加载、筛选与导航。
- `i18n.js`：中英界面字典与语言切换。
- `blog/`：正文和元数据索引；当前文章列表为空。
- `admin/`、`api/admin/`：写作后台和管理接口，需单独配置部署。

## 核心体验

- 默认浅色底、深色正文、绿色强调色；正文限制行宽，手机端自动调整布局。
- 顶部按钮切换中英文界面，语言和主题会记住并跨页保留。正文只使用作者提供的译文，缺少译文时展示原文并提示。
- 首页 → 全部文章 → 阅读页采用真实链接；返回列表保留搜索和分类条件，支持浏览器前进、后退和新标签页。
- 支持同源跨页 View Transitions 的浏览器使用短暂过渡，其余浏览器正常跳转；减少动态效果偏好会禁用过渡。
- Markdown 由本地 Marked 解析并经 DOMPurify 净化，数学公式使用本地 MathJax。

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

项目可直接部署到 GitHub Pages、Vercel、Netlify 等静态托管平台。Marked、DOMPurify 和 MathJax 已固定版本并随站点发布。升级时运行 `npm ci`、`npm run vendor` 和 `npm test`，检查 `assets/vendor/manifest.json` 后一并提交依赖锁文件与生成资源。开发和测试需要符合 package.json 要求的 Node.js 版本。

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
