import { randomBytes } from 'node:crypto';
import { basename, extname } from 'node:path';
import { readDrafts, writeDraft, removeDraft } from './store.mjs';
import { HttpError } from './http.mjs';
import { commitFiles, readRepoFile, readRepoJson } from './github.mjs';

const INDEX_PATH = 'blog/index.json';
const DEFAULT_SITE_URL = 'https://amorend.top';
const CATEGORIES = new Set(['求职', '博客', '工程']);

function cleanText(value, maxLength, field, required = true) {
  const result = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (required && !result) throw new HttpError(400, `${field}不能为空`);
  if (result.length > maxLength) throw new HttpError(400, `${field}过长`);
  return result;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizePost(input) {
  const id = cleanText(input?.id, 80, '文章 ID').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new HttpError(400, '文章 ID 只能使用小写字母、数字和连字符');
  }

  const date = cleanText(input?.date, 10, '日期');
  if (!validDate(date)) throw new HttpError(400, '日期必须是有效的 YYYY-MM-DD');

  const category = cleanText(input?.category || '工程', 20, '分类');
  if (!CATEGORIES.has(category)) throw new HttpError(400, '分类只能是求职、博客或工程');

  return {
    id,
    file: `${id}.md`,
    title: cleanText(input?.title, 160, '标题'),
    date,
    tag: cleanText(input?.tag, 60, '标签'),
    category,
    excerpt: cleanText(input?.excerpt, 500, '摘要', false),
    content: cleanText(input?.content, 900_000, '正文', false)
  };
}

function frontmatterValue(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

export function formatMarkdown(post) {
  return `---\n` +
    `title: ${frontmatterValue(post.title)}\n` +
    `date: ${frontmatterValue(post.date)}\n` +
    `tag: ${frontmatterValue(post.tag)}\n` +
    `category: ${frontmatterValue(post.category)}\n` +
    `---\n\n${String(post.content || '').trim()}\n`;
}

export function parseMarkdown(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, content: normalized.trim() };

  const meta = {};
  match[1].split('\n').forEach((line) => {
    const separator = line.indexOf(':');
    if (separator === -1) return;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = value;
  });
  return { meta, content: match[2].trim() };
}

export function sortPosts(posts) {
  return [...posts].sort((left, right) => {
    const dateDifference = new Date(right.date || 0) - new Date(left.date || 0);
    return dateDifference || String(left.title || '').localeCompare(String(right.title || ''), 'zh-CN');
  });
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateSitemap(posts, siteUrl = process.env.BLOG_SITE_URL || DEFAULT_SITE_URL, today = new Date().toISOString().slice(0, 10)) {
  const site = siteUrl.replace(/\/$/, '');
  const entry = (loc, lastmod, changefreq, priority) => `  <url>\n` +
    `    <loc>${xmlEscape(loc)}</loc>\n` +
    `    <lastmod>${lastmod}</lastmod>\n` +
    `    <changefreq>${changefreq}</changefreq>\n` +
    `    <priority>${priority}</priority>\n` +
    `  </url>`;
  const urls = [
    entry(`${site}/`, today, 'weekly', '1.0'),
    entry(`${site}/blog.html`, today, 'weekly', '0.9'),
    entry(`${site}/series.html`, today, 'weekly', '0.9'),
    ...sortPosts(posts).map((post) => entry(
      `${site}/article.html?post=${encodeURIComponent(post.id)}`,
      post.date || today,
      'monthly',
      '0.7'
    ))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

async function readState() {
  const [posts, drafts] = await Promise.all([
    readRepoJson(INDEX_PATH, []),
    readDrafts()
  ]);
  if (!Array.isArray(posts) || !Array.isArray(drafts)) throw new HttpError(502, '文章索引格式不正确');
  return { posts, drafts };
}

function publicEntry(post) {
  return {
    id: post.id,
    file: `${post.id}.md`,
    title: post.title,
    date: post.date,
    tag: post.tag,
    category: post.category,
    excerpt: post.excerpt
  };
}

function summary(post) {
  const { content, file, ...rest } = post;
  return rest;
}

function jsonFile(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function listPosts() {
  const { posts, drafts } = await readState();
  const byId = new Map(posts.map((post) => [post.id, {
    ...summary(post),
    category: post.category || '工程',
    published: true,
    hasDraft: false,
    status: 'published'
  }]));

  drafts.forEach((draft) => {
    const published = byId.get(draft.id);
    byId.set(draft.id, {
      ...summary(draft),
      published: Boolean(published),
      hasDraft: true,
      status: published ? 'changed' : 'draft'
    });
  });

  return [...byId.values()].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.date || 0);
    const rightTime = Date.parse(right.updatedAt || right.date || 0);
    return rightTime - leftTime || String(left.title).localeCompare(String(right.title), 'zh-CN');
  });
}

export async function getPost(id) {
  const safeId = cleanText(id, 80, '文章 ID');
  const { posts, drafts } = await readState();
  const draft = drafts.find((item) => item.id === safeId);
  const published = posts.find((item) => item.id === safeId);

  if (draft) return { post: normalizePost(draft), state: 'draft', published: Boolean(published), updatedAt: draft.updatedAt };
  if (!published) throw new HttpError(404, '没有找到这篇文章');

  const markdown = await readRepoFile(`blog/${published.file}`);
  const parsed = parseMarkdown(markdown);
  return {
    post: normalizePost({ ...parsed.meta, ...published, content: parsed.content }),
    state: 'published',
    published: true,
    updatedAt: null
  };
}

export async function saveDraft(input) {
  const post = normalizePost(input);
  const drafts = await readDrafts();
  if (!Array.isArray(drafts)) throw new HttpError(502, '草稿数据格式不正确');

  const now = new Date().toISOString();
  const existing = drafts.find((item) => item.id === post.id);
  const draft = { ...post, createdAt: existing?.createdAt || now, updatedAt: now };
  await writeDraft(draft);
  return { post: draft };
}

export async function publishDraft(id) {
  const safeId = cleanText(id, 80, '文章 ID');
  const { posts, drafts } = await readState();
  const draftIndex = drafts.findIndex((item) => item.id === safeId);
  if (draftIndex === -1) throw new HttpError(404, '没有找到待发布草稿，请先保存');

  const post = normalizePost(drafts[draftIndex]);
  const existingIndex = posts.findIndex((item) => item.id === post.id);
  const entry = publicEntry(post);
  const nextPosts = sortPosts(existingIndex === -1
    ? [entry, ...posts]
    : posts.map((item) => item.id === post.id ? { ...item, ...entry } : item));
  const commit = await commitFiles([
    { path: `blog/${post.file}`, content: formatMarkdown(post) },
    { path: INDEX_PATH, content: jsonFile(nextPosts) },
    { path: 'sitemap.xml', content: generateSitemap(nextPosts) }
  ], `${existingIndex === -1 ? 'content: 发布' : 'content: 更新'} ${post.title}`);

  await removeDraft(drafts[draftIndex]);
  return { post: entry, commit, created: existingIndex === -1 };
}

export async function deleteDraft(id) {
  const safeId = cleanText(id, 80, '文章 ID');
  const drafts = await readDrafts();
  if (!Array.isArray(drafts) || !drafts.some((item) => item.id === safeId)) {
    throw new HttpError(404, '没有找到这份草稿');
  }
  const draft = drafts.find((item) => item.id === safeId);
  if (!await removeDraft(draft)) throw new HttpError(409, '草稿已更新，请刷新后再删除');
  return { ok: true };
}

export async function unpublishPost(id) {
  const safeId = cleanText(id, 80, '文章 ID');
  const { posts, drafts } = await readState();
  const published = posts.find((item) => item.id === safeId);
  if (!published) throw new HttpError(404, '这篇文章当前没有发布');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(published.file || '')) {
    throw new HttpError(409, '文章文件名不安全，已停止自动下线');
  }

  const nextPosts = posts.filter((item) => item.id !== safeId);
  const commit = await commitFiles([
    { path: `blog/${published.file}`, content: null },
    { path: INDEX_PATH, content: jsonFile(nextPosts) },
    { path: 'sitemap.xml', content: generateSitemap(nextPosts) }
  ], `content: 下线 ${published.title}`);
  const draft = drafts.find((item) => item.id === safeId);
  if (draft) await removeDraft(draft);
  return { commit };
}

export async function uploadImage({ name, type, data }) {
  const mimeExtensions = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif'
  };
  const extension = mimeExtensions[type];
  if (!extension) throw new HttpError(400, '只支持 PNG、JPEG、GIF、WebP 或 AVIF 图片');

  const raw = cleanText(data, 5_000_000, '图片数据');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new HttpError(400, '图片数据不合法');
  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    throw new HttpError(400, '图片数据不合法');
  }
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) throw new HttpError(413, '图片不能超过 3 MB');
  const ascii = (start, end) => buffer.subarray(start, end).toString('ascii');
  const matches = {
    'image/png': buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/jpeg': buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255,
    'image/gif': ['GIF87a', 'GIF89a'].includes(ascii(0, 6)),
    'image/webp': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP',
    'image/avif': ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))
  };
  if (!matches[type]) throw new HttpError(400, '图片内容与声明的格式不一致');


  const originalStem = basename(String(name || 'image'), extname(String(name || 'image')))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'image';
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const suffix = randomBytes(5).toString('hex');
  const path = `assets/blog/uploads/${year}/${month}/${Date.now()}-${originalStem}-${suffix}${extension}`;
  const commit = await commitFiles(
    [{ path, content: buffer.toString('base64'), encoding: 'base64' }],
    `assets: 上传 ${basename(path)}`
  );
  return { path, markdown: `![${originalStem}](${path})`, commit };
}
