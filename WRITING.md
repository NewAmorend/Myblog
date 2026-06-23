# 写作与发布流程

这是日常往博客 / 作品集加内容的操作手册。架构上做了自动化，**大多数情况下你只需要改一两个文件**，剩下的（sitemap、SEO meta、文章列表、tag 筛选）会自己跟上。

---

## 从 Obsidian 一键发布文章（推荐）

以后从 Obsidian 发文章，优先用脚本，不需要手动改 `blog/index.json` 和 `sitemap.xml`。

### 只导入，不提交

```bash
node scripts/publish-obsidian-post.mjs 'obsidian://open?vault=Obsidian%20Vault&file=Agent中的上下文管理--offload'
```

脚本会自动做这些事：

1. 解析 Obsidian 链接，找到 vault 里的 Markdown。
2. 生成 `blog/<slug>.md`，补齐 frontmatter。
3. 把 Obsidian 图片嵌入 `![[...]]` 转成网站图片，并复制到 `assets/blog/obsidian/`。
4. 把能匹配到现有文章的 `[[内部链接]]` 转成站内文章链接。
5. 更新 `blog/index.json`。
6. 运行 `scripts/build-sitemap.mjs` 更新 `sitemap.xml`。

### 导入并直接发布

```bash
node scripts/publish-obsidian-post.mjs 'obsidian://open?vault=Obsidian%20Vault&file=Agent中的上下文管理--offload' --publish
```

`--publish` 会在工作区干净时自动执行：

1. `git pull --rebase origin <当前分支>`
2. 导入文章并更新索引 / sitemap
3. `git add`
4. `git commit -m "content: 添加 <文章标题>"`
5. `git push origin <当前分支>`

常用覆盖参数：

```bash
node scripts/publish-obsidian-post.mjs 'obsidian://open?...' \
  --tag AI-Agent \
  --title 'Agent 中的上下文管理：offload' \
  --id agent-context-management-offload \
  --excerpt '从执行转移和存储转移两个角度理解 offload。' \
  --publish
```

不确定脚本会生成什么时，先用 `--dry-run` 预览。

---

## 手动加一篇博客文章

> 站点支持中英双语。UI 文案两套都齐了；文章正文默认中文，如果想给某篇加英文版本，见 [双语文章](#双语文章) 一节。

三步：

### 1. 在 `blog/` 下新建 markdown 文件

文件名建议用 kebab-case 的英文 slug，例如 `blog/my-new-post.md`。

文件顶部必须有 frontmatter：

```markdown
---
title: 大语言模型微调实践指南
date: 2026-01-05
tag: LLM
category: 工程
---

这里写正文，支持完整 Markdown 语法。

## 二级标题

普通段落、`行内代码`、**加粗**、_斜体_、列表、表格、引用都正常。
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✓ | 文章标题，会显示在 `<h1>`、`<title>`、og:title |
| `date` | ✓ | `YYYY-MM-DD`，用于排序和 sitemap lastmod |
| `tag` | ✓ | 单个 tag，无空格用 kebab-case（如 `AI-Agent`、`Computer-Vision`） |
| `category` | ✗ | 大分类，取值 `求职` / `博客` / `工程`，默认 `工程`。决定 blog.html 顶部分类筛选条归属 |

### 2. 在 `blog/index.json` 加一条

`blog/index.json` 是文章元数据的事实源头。加在数组里任意位置（脚本会按 `date` 自动排序）：

```json
{
  "id": "my-new-post",
  "file": "my-new-post.md",
  "title": "大语言模型微调实践指南",
  "date": "2026-01-05",
  "tag": "LLM",
  "category": "工程",
  "excerpt": "从数据准备到模型部署，本文详细记录大语言模型微调的完整流程。"
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `id` | URL 里的 slug，用 `article.html?post=<id>` 访问；通常等于不带 `.md` 的文件名 |
| `file` | `blog/` 下的文件名（带 `.md`） |
| `title` / `date` / `tag` | 跟 frontmatter 保持一致 |
| `category` | 大分类（`求职` / `博客` / `工程`），决定 blog.html 顶部分类筛选条归属，不填默认 `工程` |
| `excerpt` | 1-3 句话的摘要，会显示在博客卡片、文章页副标题、og:description |

### 3. push 到 main

```bash
git add blog/my-new-post.md blog/index.json
git commit -m "新文章：xxx"
git push origin main
```

push 之后自动发生的事：

1. **GitHub Action 触发 sitemap 重建**（`.github/workflows/build-sitemap.yml`）
   - 跑 `scripts/build-sitemap.mjs`
   - 读 `blog/index.json` 重新生成 `sitemap.xml`
   - 有变化就自动 commit 一次 `chore: 自动更新 sitemap.xml [skip ci]` 回到 main
2. **GitHub Pages 重新构建** → 几十秒内 `https://amorend.top` 更新
3. **blog.html 的文章列表** fetch `blog/index.json` 时会拿到新条目，自动渲染卡片、自动加入 tag 筛选下拉、自动进入搜索索引
4. **article.html** 通过 `?post=<id>` 查询参数能直接访问，title / description / canonical / og:* 都会动态更新

**你不需要改 sitemap.xml、blog.html、article.html 中的任何代码。**

---

## 加一个作品

跟博客类似，但路径在 `work/`：

### 1. `work/your-project.md`

```markdown
---
title: 项目名
code: "#2026-001"
tags: ["AI-Agent", "Python"]
description: 一句话介绍。
---

详细介绍正文。
```

### 2. `work/index.json` 加一条

```json
{
  "id": "your-project",
  "file": "your-project.md",
  "title": "项目名",
  "code": "#2026-001",
  "tags": ["AI-Agent", "Python"],
  "description": "一句话介绍。"
}
```

### 3. push

`work.html` 加载时 fetch `work/index.json`，自动渲染卡片，点击在 modal 中展示详情。

> 作品目前仍走 modal，没有独立 URL；如果将来想给作品也加专门页面（类似 `article.html?post=`），需要另做一次架构调整。

---

## 双语文章

站点 UI 默认中英双语（顶部"EN / 中"按钮切换，URL 参数 `?lang=en` 同样生效）。文章正文默认中文；某篇文章如果你想加英文版，做两件事：

### 1. 在 `blog/` 下放英文 markdown

约定命名 `<slug>.en.md`（紧挨着中文 `<slug>.md`）。frontmatter 同样需要：

```markdown
---
title: My English Title
date: 2026-04-04
tag: AI-Agent
---

English body...
```

### 2. 在 `blog/index.json` 的对应条目加 `i18n` 字段

```json
{
  "id": "ai-agent-paradigms",
  "file": "ai-agent-paradigms.md",
  "title": "几个 Agent 常见范式的思考",
  "date": "2026-04-04",
  "tag": "AI-Agent",
  "excerpt": "...",
  "i18n": {
    "en": {
      "title": "Notes on Agent paradigms",
      "excerpt": "ReAct, Reflection, Plan-Solve — three angles...",
      "file": "ai-agent-paradigms.en.md"
    }
  }
}
```

### 行为说明

- 切到 EN 后，博客列表用 `i18n.en.title` 和 `i18n.en.excerpt`；点开后 article.html 加载 `i18n.en.file`
- 没加 `i18n.en` 的文章，EN 模式下继续显示中文标题，点开后 article.html 加载中文原文并显示提示 *"This post has no English version yet — showing the Chinese original below."*
- 不要在 `blog/index.json` 直接重复列条目，i18n 是同一篇文章的"另一种语言版本"，靠 `i18n` 嵌套字段标记

作品 (`work/index.json`) 同样支持 `i18n.en: { title, description, file }` 字段，行为相同（点击作品在 modal 中展示，按需切换语言）。

---

## OG 图（社交分享缩略图）

四个页面都引用了 `https://amorend.top/og-image.svg`，分享到 Facebook / LinkedIn / 微信 等大部分平台会显示这张缩略图。

源文件是 SVG（`og-image.svg`），1200×630。优势：可矢量缩放、文件小、易改。Twitter 历史上对 SVG 的支持时好时坏；如果发现 X / Twitter 抓不到缩略图，做一份 PNG 副本：

```bash
# macOS（用 librsvg, brew install librsvg）
rsvg-convert -w 1200 -h 630 og-image.svg > og-image.png

# 或在线工具：把 og-image.svg 拖到 cloudconvert.com 转 1200×630 PNG
```

转完后改 4 个 HTML 文件里的 `og:image` 引用从 `og-image.svg` 改为 `og-image.png`。

调试社交卡片缩略图：[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) / [Twitter Card Validator](https://cards-dev.twitter.com/validator) / 微信扫码看分享卡片。

---

## 代码高亮

文章正文（article.html）和作品详情（work.html modal）都接入了 [highlight.js](https://highlightjs.org/)，主题用 **gruvbox-dark** / **gruvbox-light**，跟站点主题自动切换。

写代码块时用 fenced code block + 语言名：

````markdown
```python
def hello():
    print("Hi")
```
````

支持的语言见 highlight.js 文档（Python/JS/TS/Rust/Go/Bash/SQL/JSON/YAML/HTML/CSS 都齐了）。未指定语言或语言不认识时回退到无样式 plain text。

---

## 本地预览

不需要构建工具，纯静态：

```bash
python3 -m http.server 8765
# 浏览器打开 http://localhost:8765/blog.html
```

或者用 VS Code 的 Live Server / 任意静态服务器。

---

## 不需要做的事（已经自动化）

| 想做的事 | 自动化方案 |
|---|---|
| 更新 sitemap.xml | GitHub Action 在 push 后自动重建 |
| 给新文章加 og:title / canonical | `article.html` 的 JS 根据 `?post=` 动态注入 |
| 把新分类加到 blog 筛选按钮 | blog.html 的分类（求职/博客/工程）固定写在 `data-categories`，按钮上的篇数随 `blog/index.json` 自动更新 |
| 让搜索能搜到新文章 | 搜索直接在已加载的数据上做子串匹配，自动覆盖 |
| 把新文章加进文章列表 | blog.html 的 research-log 频道动态渲染 |

---

## 主题、字体、设计 token

四个页面 `index.html` / `blog.html` / `article.html` / `work.html` 共用同一套 CSS 变量（"系统 A"）：

- `--bg` / `--bg-soft`：背景
- `--paper` / `--paper-muted`：正文文字（在浅色模式下变成深色）
- `--accent` / `--accent-2` / `--accent-3`：强调色（terracotta / wheat / sage）
- `--line` / `--line-strong`：分割线 / 边框
- `--nav-bg`：导航栏毛玻璃背景

默认深色，OS 偏好为浅色时自动切换；右上角主题按钮也能手动切。

> 主题选择目前**不跨页面保留**——切到浅色后跳到另一页会回到 OS 偏好。如果以后想加 `localStorage` 持久化，是一个独立小任务。

---

## 文件结构速查

```
.
├── index.html              # 入口（meta-refresh 跳 blog.html）
├── blog.html               # 博客主页：5 频道 + 研究手记频道下的全文章列表
├── article.html            # 文章详情页（通过 ?post=<id> 加载）
├── work.html               # 作品集（modal 展开详情）
├── blog/
│   ├── index.json          # 博客元数据（事实源头）
│   └── *.md                # 文章内容（带 frontmatter）
├── work/
│   ├── index.json          # 作品元数据
│   └── *.md                # 作品详情
├── Music/                  # 背景音乐
├── sitemap.xml             # 由 Action 自动生成，不要手改
├── robots.txt              # Cloudflare 会在 edge 自动加 AI 爬虫拦截规则
├── CNAME                   # GitHub Pages 自定义域：amorend.top
├── scripts/
│   └── build-sitemap.mjs   # sitemap 生成脚本
└── .github/workflows/
    └── build-sitemap.yml   # push 后自动跑 sitemap 脚本
```

---

## 部署链路

```
git push main
   │
   ├─► Action: Build sitemap
   │     └─► 生成 sitemap.xml, 有 diff 时自动 commit 回 main
   │
   └─► Pages: build & deploy
         └─► 几十秒后 amorend.top 更新
```

域名走 Cloudflare → GitHub Pages，HTTPS 由 Cloudflare 提供。Cloudflare SSL 模式建议保持 **Full**。

---

## 何时需要更大的架构调整

参考分阶段计划（当前 7 篇文章，目前架构吃得下到 ~50 篇）：

| 文章数 | 建议动作 |
|---|---|
| ≤ 20 | 现状即可 |
| 20-50 | 筛选 + 搜索已就位，无需改动 |
| 50-200 | 加分页或 "Show more"；或按年份折叠 |
| 200+ | 考虑迁移到 Astro / Eleventy，每篇预渲染独立 HTML（`/blog/<slug>` 取代 `?post=<id>`，SEO 更友好） |
