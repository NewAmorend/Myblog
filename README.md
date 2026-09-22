# Amorend 个人网站

一个面向 AI 研究、工程项目和博客写作的静态个人网站。新版将页面结构、黑白灰蓝视觉系统和轻量交互逻辑集中到共享资源中，保持纯静态部署，同时降低后续维护成本。

## 文件结构

```text
Myblog/
├── index.html          # 首页：个人定位、项目预览、文章预览
├── admin/              # 私有写作后台界面
├── api/admin/          # Vercel Functions：鉴权与内容管理 API
├── work.html           # 作品列表页：动态读取 work/index.json，支持作品详情弹窗
├── blog.html           # 博客列表页：动态读取 blog/index.json
├── article.html        # 文章详情页：根据 ?post=xxx 加载 Markdown
├── assets/
│   ├── site.css        # 共享视觉系统、响应式布局、组件样式
│   └── site.js         # 数据加载、主题、菜单、轻量入场动画、弹窗
├── blog/               # 博客 Markdown 与索引
├── work/               # 作品 Markdown 与索引
└── Music/              # 背景音乐资源
```

## 技术栈

- GSAP 3：标题和内容块的 transform/opacity 入场动画
- IntersectionObserver：轻量触发一次性入场动画，减少滚动时的计算压力
- marked：将 Markdown 渲染为文章或作品详情
- 原生 HTML/CSS/JavaScript：无构建步骤，可直接静态部署

## 核心体验

- 首页不再跳转，而是作为真正的第一屏入口。
- 博客、作品、文章页共用同一套导航、主题和黑白灰蓝组件系统。
- 高级感来自独立背景动效、区块内部几何装饰、卡片细节和一次性入场动画；滚动仍保持浏览器原生机制。
- 背景动画由少量固定几何元素和 GSAP transform/opacity timeline 组成，不读取滚动位置。
- 背景不再使用 Canvas、固定视口几何层或连续滚动动画，优先保证滚动流畅度。
- 作品详情通过弹窗展示，背景滚动会被锁定，关闭后恢复原滚动位置。
- 支持明暗主题，并记住用户选择。
- 动画遵守 `prefers-reduced-motion`，减少动效偏好用户会得到更轻的体验。

## 本地运行

```bash
python3 -m http.server 4173
```

然后访问：

```text
http://localhost:4173/
```

不要直接用文件协议打开页面，因为博客、作品和文章内容依赖 `fetch()` 读取本地 JSON/Markdown 文件。

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

## 添加作品项目

1. 在 `work/` 下新增 Markdown 文件。
2. 在 `work/index.json` 中添加对应条目：

```json
{
  "id": "your-work-id",
  "file": "your-work.md",
  "title": "项目标题",
  "code": "#2026-001",
  "tags": ["AI", "Web"],
  "description": "项目简介"
}
```

3. 打开 `work.html`，点击对应作品卡片检查详情弹窗。

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
