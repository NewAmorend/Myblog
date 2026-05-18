# Amorend 个人网站

一个现代化的个人作品集和博客网站，采用 Apple 风格的液态玻璃设计。

## 📁 文件结构

详细版见 [WRITING.md](WRITING.md#文件结构速查)。

```
.
├── index.html          # 入口（meta-refresh 跳 blog.html）
├── blog.html           # 博客主页：5 频道 + 研究手记下的全文章列表
├── article.html        # 文章详情页（?post=<id>）
├── work.html           # 作品集（modal 展开详情）
├── blog/               # 博客文章 (*.md) + index.json
├── work/               # 作品详情 (*.md) + index.json
├── Music/              # 背景音乐
├── scripts/            # 自动化脚本（sitemap 生成）
└── .github/workflows/  # GitHub Actions
```

## ✨ 特性

### 设计特点
- **Apple 风格液态玻璃**：导航栏、模态框使用 backdrop-filter 实现毛玻璃效果
- **生成式线条艺术背景**：HTML5 Canvas 实现，支持鼠标交互涟漪效果
- **平滑滚动**：Lenis + GSAP ScrollTrigger 实现流畅的滚动动画
- **响应式设计**：完美适配桌面和移动设备

### 技术栈
- **GSAP 3.12.5**：强大的动画库
- **ScrollTrigger**：滚动触发动画
- **Lenis**：平滑滚动体验
- **CSS Backdrop Filter**：液态玻璃效果

## 🎯 核心功能

### 1. 入口 (index.html)
- meta-refresh 立即跳转到 blog.html

### 2. 博客主页 (blog.html)
- 5 个内容频道：研究手记、摄影集、正在听、社交、灵感档案
- "研究手记" 频道下嵌入完整文章列表，支持 tag 单选筛选 + 关键词搜索
- 文章数据来自 `blog/index.json`，加新文章自动出现

### 3. 文章详情 (article.html)
- 通过 `?post=<id>` 加载对应 markdown
- title / description / canonical / og:* 由 JS 动态注入，对爬虫和分享卡片友好
- 上下篇导航

### 4. 作品页面 (work.html)
- 8+ 个作品项目网格
- 点击作品在 modal 中展开详情（modal 仅 work 页保留，blog 已改为独立页面）

### 5. 音乐播放
- 右下角浮动按钮控制
- 自动播放（需用户交互，浏览器策略）
- 播放状态脉冲动效

### 6. 主题切换
- 支持明/暗主题，自动检测系统偏好
- 四个页面共用同一套 CSS token，体验一致
- 目前不跨页面持久化（每次切换基于 OS 偏好）

## 📝 添加新文章

日常写作和发布流程见 [WRITING.md](WRITING.md)。简版：

1. 在 `blog/` 下新建 markdown 文件（带 frontmatter）
2. 在 `blog/index.json` 加一条元数据
3. `git push` 到 main

sitemap、tag 筛选、搜索、SEO meta 都会自动跟上，不需要改其它文件。

## 🚀 部署建议

- **静态托管**：可直接部署到 GitHub Pages, Netlify, Vercel
- **CDN**：GSAP 和 Lenis 已使用 CDN
- **性能优化**：
  - 使用图片压缩
  - 启用 gzip/brotli
  - 配置缓存策略

## 📱 浏览器支持

- Chrome/Edge 90+
- Safari 14+
- Firefox 88+

## 🎵 音乐来源

"在雨后醒来" - 艾志恒Asen

## 👤 作者

Amorend - 厦门大学软件工程专业

---
最后更新：2026-02-16
