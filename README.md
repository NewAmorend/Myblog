# Amorend 个人网站

一个面向 AI 研究、工程项目和博客写作的静态个人网站。新版将页面结构、黑白灰蓝视觉系统和轻量交互逻辑集中到共享资源中，保持纯静态部署，同时降低后续维护成本。

## 文件结构

```text
Myblog/
├── index.html          # 首页：个人定位、项目预览、文章预览
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

项目可直接部署到 GitHub Pages、Vercel、Netlify 等静态托管平台。当前外部依赖使用 CDN，如果需要更强的离线可用性，可以后续把 GSAP 和 marked 固定到本地资源。
