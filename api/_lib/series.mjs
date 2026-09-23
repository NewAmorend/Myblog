import { HttpError } from './http.mjs';
import { commitFiles, readRepoJson } from './github.mjs';
import { generateSitemap } from './posts.mjs';

const SERIES_PATH = 'series/index.json';
const INDEX_PATH = 'blog/index.json';

function cleanText(value, maxLength, field, required = true) {
  const result = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (required && !result) throw new HttpError(400, `${field}不能为空`);
  if (result.length > maxLength) throw new HttpError(400, `${field}过长`);
  return result;
}

export function normalizeSeries(input, existing = null) {
  const id = cleanText(input?.id, 80, '系列 ID').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new HttpError(400, '系列 ID 只能使用小写字母、数字和连字符');
  }
  const chapters = Array.isArray(input?.chapters) ? input.chapters.map((chapter) => cleanText(chapter, 80, '章节 ID')) : [];
  if (new Set(chapters).size !== chapters.length) throw new HttpError(400, '同一章节不能重复加入系列');
  if (chapters.some((chapter) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapter))) {
    throw new HttpError(400, '章节 ID 格式不正确');
  }
  return {
    id,
    title: cleanText(input?.title, 160, '系列标题'),
    description: cleanText(input?.description, 1000, '系列简介'),
    prerequisites: cleanText(input?.prerequisites, 1000, '阅读前提', false),
    chapters,
    ...(existing?.translations ? { translations: existing.translations } : {})
  };
}

async function readPublicState() {
  const [series, posts] = await Promise.all([
    readRepoJson(SERIES_PATH, []),
    readRepoJson(INDEX_PATH, [])
  ]);
  if (!Array.isArray(series) || !Array.isArray(posts)) throw new HttpError(502, '公开内容索引格式不正确');
  return { series, posts };
}

function validateChapters(next, posts, allSeries, currentId) {
  const postIds = new Set(posts.map((post) => post.id));
  const missing = next.chapters.find((id) => !postIds.has(id));
  if (missing) throw new HttpError(409, `章节 ${missing} 尚未发布`);
  const claimed = new Map();
  allSeries.filter((item) => item.id !== currentId).forEach((item) => {
    (item.chapters || []).forEach((id) => claimed.set(id, item.title || item.id));
  });
  const conflict = next.chapters.find((id) => claimed.has(id));
  if (conflict) throw new HttpError(409, `章节 ${conflict} 已属于「${claimed.get(conflict)}」`);
}

export async function listSeries() {
  const { series, posts } = await readPublicState();
  const titles = new Map(posts.map((post) => [post.id, post.title]));
  return series.map((item) => ({
    ...item,
    chapterCount: (item.chapters || []).filter((id) => titles.has(id)).length,
    chapterTitles: (item.chapters || []).map((id) => titles.get(id) || id)
  }));
}

export async function getSeries(id) {
  const safeId = cleanText(id, 80, '系列 ID');
  const { series } = await readPublicState();
  const item = series.find((entry) => entry.id === safeId);
  if (!item) throw new HttpError(404, '没有找到这个系列');
  return normalizeSeries(item, item);
}

export async function publishSeries(input) {
  const { series, posts } = await readPublicState();
  const existingIndex = series.findIndex((item) => item.id === String(input?.id || '').trim().toLowerCase());
  const existing = existingIndex === -1 ? null : series[existingIndex];
  const item = normalizeSeries(input, existing);
  validateChapters(item, posts, series, item.id);
  const nextSeries = existingIndex === -1
    ? [...series, item]
    : series.map((entry) => entry.id === item.id ? item : entry);
  const commit = await commitFiles([
    { path: SERIES_PATH, content: `${JSON.stringify(nextSeries, null, 2)}\n` },
    { path: 'sitemap.xml', content: generateSitemap(posts, undefined, undefined, nextSeries) }
  ], `${existing ? 'content: 更新系列' : 'content: 创建系列'} ${item.title}`);
  return { series: item, commit, created: !existing };
}

export async function unpublishSeries(id) {
  const safeId = cleanText(id, 80, '系列 ID');
  const { series, posts } = await readPublicState();
  const item = series.find((entry) => entry.id === safeId);
  if (!item) throw new HttpError(404, '这个系列当前没有发布');
  const nextSeries = series.filter((entry) => entry.id !== safeId);
  const commit = await commitFiles([
    { path: SERIES_PATH, content: `${JSON.stringify(nextSeries, null, 2)}\n` },
    { path: 'sitemap.xml', content: generateSitemap(posts, undefined, undefined, nextSeries) }
  ], `content: 下线系列 ${item.title}`);
  return { commit };
}
