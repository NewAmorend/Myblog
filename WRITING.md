# 写作与发布流程

这是日常往博客加内容的操作手册。架构上做了自动化，**大多数情况下你只需要改一两个文件**，剩下的（sitemap、SEO meta、文章列表、分类筛选）会自己跟上。

---

## 在写作后台发布（最省事）

本机使用时，先双击 `启动写作后台.command`，再打开：

```text
http://127.0.0.1:4317/admin/
```

推荐流程：

1. 点击“新建文章”，填写标题、标签、分类和摘要。
2. 在 Markdown 编辑器写正文；可以切换“分栏”或“预览”，图片可直接上传并插入。
3. 随时点击“保存草稿”（或按 `⌘/Ctrl + S`）。本机模式的草稿保存在 `.blog-admin/local.sqlite`，不进入公开 Git 仓库；另行部署线上后台时才使用私有 Redis。
4. 点击“发布”。后台会一次性提交 Markdown、`blog/index.json` 和 `sitemap.xml`，成功后清理私有存储中的对应草稿版本。
5. Vercel/GitHub 收到提交后自动重新部署，通常几十秒内生效。

编辑已发布文章时，后台先保存一份未发布修改；再次点击“更新发布”才会覆盖线上文章。“下线文章”会从公开索引和仓库当前版本中删除正文，但 Git 历史仍然可以恢复。

后台环境变量与首次部署步骤见 [README.md](README.md#写作后台部署)。

---

## 从 Obsidian 一键导入文章

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
| `title` | ✓ | 文章标题，会显示在 `<h1>`、`<title>` |
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
| `excerpt` | 1-3 句话的摘要，会显示在博客卡片、文章页副标题 |

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
3. **blog.html 的文章列表** fetch `blog/index.json` 时会拿到新条目，自动渲染列表、更新分类数量并纳入搜索
4. **article.html** 通过 `?post=<id>` 查询参数能直接访问，页面标题会随文章更新

**你不需要改 sitemap.xml、blog.html、article.html 中的任何代码。**

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

### 2. 在 `blog/index.json` 的对应条目加 `translations` 字段

```json
{
  "id": "ai-agent-paradigms",
  "file": "ai-agent-paradigms.md",
  "title": "几个 Agent 常见范式的思考",
  "date": "2026-04-04",
  "tag": "AI-Agent",
  "excerpt": "...",
  "translations": {
    "en": {
      "title": "Notes on Agent paradigms",
      "excerpt": "ReAct, Reflection, Plan-Solve — three angles...",
      "file": "ai-agent-paradigms.en.md"
    }
  }
}
```

### 行为说明

- 切到 EN 后，博客列表用 `translations.en.title` 和 `translations.en.excerpt`；点开后 article.html 加载 `translations.en.file`
- 没加 `translations.en` 的文章，EN 模式下继续显示中文标题，点开后 article.html 加载中文原文并显示提示 *"This post has no English version yet — showing the Chinese original below."*
- 不要在 `blog/index.json` 直接重复列条目，translations 是同一篇文章的"另一种语言版本"，靠 `translations` 嵌套字段标记

原文默认中文；英文原文请在索引顶层添加 `"language": "en"`，中文译文放在 `translations.zh`。译文文件名仅允许英文字母、数字、下划线、短横线和点，并以 `.md` 结尾。当前写作后台与导入脚本不提供译文编辑功能，译文应直接维护文件和索引，后续通过后台更新时需核对这些字段。

## 组织一个系列

正文与元数据仍放在 `blog/` 和 `blog/index.json`。再在 `series/index.json` 添加系列信息，例如：

```json
[
  {
    "id": "systems-notes",
    "title": "系统学习笔记",
    "description": "介绍这个系列要解决的问题、内容范围和适合的读者。",
    "prerequisites": "读者需要具备的基础。此字段可以省略。",
    "chapters": ["first-chapter", "second-chapter"],
    "translations": {
      "en": {
        "title": "Systems Notes",
        "description": "The scope and intended audience of this series.",
        "prerequisites": "The background readers should have."
      }
    }
  }
]
```

- `chapters` 填写 `blog/index.json` 中的文章 `id`，数组顺序就是阅读顺序，与发布日期无关。
- 一个系列的 `id` 必须唯一，一篇文章只能归属于一个系列，重复编排会显示内容加载错误。
- 已归属系列的文章不再出现在独立文章列表，原来的文章链接保持有效。
- 未发布或已下线的章节不会形成可点击链接；上线新的正文后，对应章节自动出现在目录中。正式目录建议只列已发布章节。
- 系列元数据的译文不需要 Markdown 文件；正文译文按前文方式配置。切换语言不会离开当前系列或章节。
- 可直接访问 `series.html?series=systems-notes`。首次发布建议把系列目录和章节一起提交，避免中间状态。
- 当前后台仍负责单篇文章的发布，系列创建与排序直接编辑 `series/index.json`；章节归属不依赖后台表单字段，更新文章不会覆盖目录顺序。

## 阅读与导航

首页只展示 bio、系列与文章入口，以及 GitHub、邮箱链接；不显示文章或系列预览。内容页显示统一顶部导航。

独立文章支持按标题、摘要和标签搜索，以及分类筛选。系列阅读页显示完整章节目录，突出当前章节；桌面端左侧常驻，手机端通过“系列目录”展开。本章的小节目录可在当前章节下展开。独立文章只显示本文目录和返回列表，不强加相邻文章。

默认浅色黑白主题，文字按钮可切换深色。语言与主题保存在本地。页面使用普通链接，支持浏览器前进、后退和新标签页。

代码块采用等宽字体和可横向滚动容器，数学公式由 MathJax 渲染。站点不自动翻译正文，也不生成虚构文章。

## 本地验证与部署

```bash
npm test
npm run check
npm run build
python3 -m http.server 4173 --directory dist
```

访问 `http://localhost:4173/`。`dist` 是可重新生成的输出目录，临时排版样例不要写入正式的 `blog/`。

提交到 main 后，GitHub Pages 自动部署；文章或系列索引变化还会触发 sitemap 更新。域名使用 Cloudflare → GitHub Pages，后台 API 则需按 README 单独部署。
