import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const fixtures = [
  { id: 'draft-one', title: '检索草稿', status: 'draft', published: false, tag: 'AI', category: '工程', date: '2026-10-27', seriesId: 'learning' },
  { id: 'changed-one', title: '待更新文章', status: 'changed', published: true, tag: 'Notes', date: '2026-10-26' },
  { id: 'published-one', title: '<img src=x onerror=alert(1)>', status: 'published', published: true, tag: 'Web', date: '2026-10-25' }
];

async function setup({ posts = fixtures, failSave = false, failLoad = false, analytics = { configured: false }, failAnalytics = false } = {}) {
  const dom = new JSDOM(await readFile('admin/index.html', 'utf8'), { url: 'https://blog.test/admin/', runScripts: 'outside-only' });
  const w = dom.window;
  const writes = [];
  let saved = null;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.fetch = async (path, options = {}) => {
    let payload;
    let ok = true;
    let status = 200;
    if (path === '/api/admin/session') payload = { csrf: 'test-csrf' };
    else if (path.startsWith('/api/admin/analytics?')) {
      if (failAnalytics) { ok = false; status = 502; payload = { error: 'Cloudflare 暂时不可用' }; }
      else payload = analytics;
    }
    else if (path === '/api/admin/posts') {
      if (failLoad) { ok = false; status = 502; payload = { error: '读取失败，请重试' }; }
      else payload = { posts: saved ? [...posts.filter((post) => post.id !== saved.id), { ...saved, status: 'draft', published: false }] : posts };
    } else if (path === '/api/admin/series') payload = { series: [{ id: 'learning', title: '学习系列', chapters: [], chapterCount: 0 }] };
    else if (options.method === 'PUT') {
      writes.push({ path, options });
      if (failSave) { ok = false; status = 503; payload = { error: '草稿保存失败' }; }
      else { saved = JSON.parse(options.body).post; payload = { post: saved }; }
    } else if (path.startsWith('/api/admin/post?id=')) {
      const post = posts.find((item) => item.id === new URL(path, w.location.href).searchParams.get('id'));
      payload = { post: { category: '工程', excerpt: '', content: '正文内容', ...post }, state: post.status === 'published' ? 'published' : 'draft', published: post.published };
    } else throw new Error(`意外请求：${path}`);
    return { ok, status, json: async () => payload };
  };
  w.eval(await readFile('admin/admin.js', 'utf8'));
  await settle();
  return { dom, w, d: w.document, writes };
}

function input(w, element, value) {
  element.value = value;
  element.dispatchEvent(new w.Event('input', { bubbles: true }));
}

test('未接入统计时显示配置提示，不显示模拟指标', async () => {
  const { dom, d } = await setup();
  try {
    assert.equal(d.querySelector('[data-analytics]').hidden, false);
    assert.equal(d.querySelector('[data-analytics-content]').hidden, true);
    assert.match(d.querySelector('[data-analytics-message]').textContent, /尚未连接 Cloudflare/);
    assert.equal(d.querySelector('[data-analytics-metrics]').children.length, 0);
    assert.equal(d.querySelectorAll('[data-board]').length, 0);
  } finally { dom.window.close(); }
});

test('文章编辑保留未保存提醒，保存后可返回统计页', async () => {
  const { dom, w, d, writes } = await setup();
  try {
    d.querySelector('[data-post-list] [data-post-id]').click(); await settle();
    assert.equal(d.querySelector('[data-analytics]').hidden, true);
    assert.equal(d.querySelector('[data-title]').value, '检索草稿');
    assert.equal(d.querySelector('[data-post-settings]').open, false);
    input(w, d.querySelector('[data-title]'), '新的草稿标题');
    w.confirm = () => false;
    d.querySelector('.back-to-analytics').click();
    assert.equal(d.querySelector('[data-editor]').hidden, false);
    d.querySelector('[data-save]').click(); await settle();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].options.headers['X-Admin-CSRF'], 'test-csrf');
    d.querySelector('.back-to-analytics').click();
    assert.equal(d.querySelector('[data-analytics]').hidden, false);
    assert.match(d.querySelector('[data-post-list]').textContent, /新的草稿标题/);
  } finally { dom.window.close(); }
});

test('保存失败保留正文与未保存提醒，不把文章误标为已保存', async () => {
  const { dom, w, d } = await setup({ failSave: true });
  try {
    d.querySelector('[data-post-list] [data-post-id]').click(); await settle();
    input(w, d.querySelector('[data-content]'), '需要保留的正文');
    d.querySelector('[data-save]').click(); await settle();
    assert.equal(d.querySelector('[data-content]').value, '需要保留的正文');
    assert.match(d.querySelector('[data-save-state]').textContent, /未保存/);
    assert.match(d.querySelector('[data-toast]').textContent, /草稿保存失败/);
    w.confirm = () => false;
    d.querySelector('.back-to-analytics').click();
    assert.equal(d.querySelector('[data-analytics]').hidden, true);
  } finally { dom.window.close(); }
});

test('工具栏保留选中文字、多行列表完整添加前缀，专注模式可退出', async () => {
  const { dom, w, d } = await setup();
  try {
    d.querySelector('[data-new-content]').click();
    const content = d.querySelector('[data-content]');
    input(w, content, '保留这段文字'); content.select();
    d.querySelector('[data-insert="**粗体**"]').click();
    assert.equal(content.value, '**保留这段文字**');
    input(w, content, '第一行\n第二行'); content.select();
    d.querySelector('[data-prefix="- "]').click();
    assert.equal(content.value, '- 第一行\n- 第二行');
    d.querySelector('[data-focus-mode]').click();
    assert.equal(d.body.classList.contains('focus-writing'), true);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(d.body.classList.contains('focus-writing'), false);
  } finally { dom.window.close(); }
});

test('折叠设置校验失败时展开并退出专注，统计页可新建文章', async () => {
  const { dom, d } = await setup({ posts: [] });
  try {
    d.querySelector('[data-new-content]').click();
    d.querySelector('[data-focus-mode]').click();
    d.querySelector('[data-save]').click(); await settle();
    assert.equal(d.querySelector('[data-post-settings]').open, true);
    assert.equal(d.body.classList.contains('focus-writing'), false);
  } finally { dom.window.close(); }
});

test('统计失败可以重试，不影响打开文章', async () => {
  const { dom, d } = await setup({ failAnalytics: true });
  try {
    assert.match(d.querySelector('[data-analytics-message]').textContent, /Cloudflare 暂时不可用/);
    assert.equal(d.querySelector('[data-refresh-analytics]').disabled, false);
    d.querySelector('[data-post-list] [data-post-id]').click(); await settle();
    assert.equal(d.querySelector('[data-title]').value, '检索草稿');
  } finally { dom.window.close(); }
});

test('统计指标、趋势和地区正确展示，并转义上游名称', async () => {
  const { dom, w, d } = await setup({ analytics: {
    configured: true, start: '2026-10-20', end: '2026-10-26', fetchedAt: '2026-10-27T00:00:00Z',
    totals: { pageViews: 120, requests: 800, bytes: 1024, cachedRequests: 400, dailyUniqueIPs: 70 },
    daily: [{ date: '2026-10-20', pageViews: 120, requests: 800, bytes: 1024, uniqueIPs: 70 }],
    countries: [{ name: '<img src=x onerror=alert(1)>', value: 800 }], browsers: [{ name: 'Firefox', value: 120 }]
  } });
  try {
    assert.equal(d.querySelector('[data-analytics-content]').hidden, false);
    assert.match(d.querySelector('[data-analytics-metrics]').textContent, /50.0%/);
    assert.match(d.querySelector('[data-analytics-daily]').textContent, /800/);
    assert.equal(d.querySelectorAll('[data-analytics-countries] img').length, 0);
    assert.match(d.querySelector('[data-analytics-countries]').textContent, /<img/);
    assert.equal(d.querySelectorAll('[data-analytics-chart] circle').length, 1);
    const range = d.querySelector('[data-analytics-range]');
    range.value = '30'; range.dispatchEvent(new w.Event('change')); await settle();
    assert.equal(d.querySelector('[data-refresh-analytics]').disabled, false);
  } finally { dom.window.close(); }
});
