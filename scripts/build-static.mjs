import { cp, mkdir, rm } from 'node:fs/promises';
// 仅发布白名单静态文件，避免环境配置、测试与私有数据进入站点输出。
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const path of ['index.html', 'blog.html', 'article.html', 'series.html', 'series', 'assets', 'admin', 'blog', 'Music', 'templates', 'i18n.js', 'og-image.svg', 'robots.txt', 'sitemap.xml', '.nojekyll', 'CNAME']) {
  await cp(path, `dist/${path}`, { recursive: true });
}
