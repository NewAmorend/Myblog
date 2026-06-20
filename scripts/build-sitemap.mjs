#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SITE = 'https://amorend.top';
const today = new Date().toISOString().slice(0, 10);

function entry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function readJson(rel) {
  try {
    return JSON.parse(await readFile(resolve(repoRoot, rel), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function main() {
  const blog = await readJson('blog/index.json');
  const sortedBlog = [...blog].sort((a, b) => new Date(b.date) - new Date(a.date));

  const urls = [
    entry(`${SITE}/`, today, 'weekly', '1.0'),
    entry(`${SITE}/blog.html`, today, 'weekly', '0.9'),
    ...sortedBlog.map((post) =>
      entry(
        `${SITE}/article.html?post=${encodeURIComponent(post.id)}`,
        post.date || today,
        'monthly',
        '0.7'
      )
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  await writeFile(resolve(repoRoot, 'sitemap.xml'), xml);
  console.log(`Generated sitemap.xml with ${urls.length} URLs (${sortedBlog.length} blog posts).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
