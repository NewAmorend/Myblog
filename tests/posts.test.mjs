import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMarkdown,
  generateSitemap,
  normalizePost,
  parseMarkdown,
  sortPosts
} from '../api/_lib/posts.mjs';

const sample = {
  id: 'agent-context-notes',
  title: 'Agent 上下文：一份笔记',
  date: '2026-08-02',
  tag: 'AI-Agent',
  category: '工程',
  excerpt: '一份用于测试的摘要。',
  content: '## 开始\n\n正文内容。'
};

test('文章数据会被规范化为现有博客结构', () => {
  assert.deepEqual(normalizePost(sample), {
    ...sample,
    file: 'agent-context-notes.md'
  });
});

test('文章可以选择系列，系列 ID 不会写入公开 Markdown', () => {
  const post = normalizePost({ ...sample, seriesId: 'agent-systems' });
  assert.equal(post.seriesId, 'agent-systems');
  assert.doesNotMatch(formatMarkdown(post), /seriesId/);
  assert.throws(() => normalizePost({ ...sample, seriesId: '非法 系列' }), /系列 ID/);
});

test('非法 slug、日期和分类会被拒绝', () => {
  assert.throws(() => normalizePost({ ...sample, id: '中文 ID' }), /文章 ID/);
  assert.throws(() => normalizePost({ ...sample, date: '2026-02-30' }), /日期/);
  assert.throws(() => normalizePost({ ...sample, category: '随笔' }), /分类/);
});

test('Markdown frontmatter 与正文可以往返', () => {
  const markdown = formatMarkdown(sample);
  const parsed = parseMarkdown(markdown);
  assert.equal(parsed.meta.title, sample.title);
  assert.equal(parsed.meta.category, sample.category);
  assert.equal(parsed.content, sample.content);
});

test('文章按日期倒序排列且不修改原数组', () => {
  const posts = [
    { id: 'old', title: '旧', date: '2025-01-01' },
    { id: 'new', title: '新', date: '2026-01-01' }
  ];
  assert.deepEqual(sortPosts(posts).map((post) => post.id), ['new', 'old']);
  assert.equal(posts[0].id, 'old');
});

test('sitemap 包含公开文章并正确转义查询参数', () => {
  const sitemap = generateSitemap([sample], 'https://example.com/', '2026-08-02', [{ id: 'agent-systems' }]);
  assert.match(sitemap, /https:\/\/example\.com\/article\.html\?post=agent-context-notes/);
  assert.match(sitemap, /https:\/\/example\.com\/series\.html\?series=agent-systems/);
  assert.match(sitemap, /<lastmod>2026-08-02<\/lastmod>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
});
