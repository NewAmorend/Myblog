import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createSession, requireSession, requireMutationSession, revokeSession, assertSameOrigin } from '../api/_lib/auth.mjs';
import { readJsonBody } from '../api/_lib/http.mjs';
import login from '../api/admin/login.mjs';
import { saveDraft, deleteDraft } from '../api/_lib/posts.mjs';
import { readDrafts, removeDraft, writeDraft } from '../api/_lib/store.mjs';
import { mockStore } from './helpers/store.mjs';
mockStore();
process.env.BLOG_ADMIN_PASSWORD = 'security-test-long-password';
process.env.BLOG_ADMIN_SECRET = 'security-test-independent-secret-32-characters';
process.env.BLOG_GITHUB_TOKEN = 'test-only';
const request = (extra = {}) => ({ method: 'POST', headers: { host: 'blog.test', origin: 'https://blog.test', 'x-forwarded-proto': 'https', ...extra } });
const response = () => ({ headers: {}, statusCode: 0, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } });

test('退出撤销会话后，原 Cookie 无法再使用', async () => {
  const session = await createSession(request());
  const req = request({ cookie: session.cookie.split(';')[0], 'x-admin-csrf': session.csrf });
  await revokeSession(await requireMutationSession(req));
  await assert.rejects(() => requireSession(req), { status: 401 });
});

test('改密码立即撤销旧会话，篡改签名和非法 Cookie 均被拒绝', async () => {
  const session = await createSession(request());
  const cookie = session.cookie.split(';')[0];
  await assert.rejects(() => requireSession(request({ cookie: `${cookie}tamper` })), { status: 401 });
  await assert.rejects(() => requireSession(request({ cookie: 'amorend_admin_session=%xx' })), { status: 401 });
  const old = process.env.BLOG_ADMIN_PASSWORD;
  try {
    process.env.BLOG_ADMIN_PASSWORD = 'changed-security-test-password';
    await assert.rejects(() => requireSession(request({ cookie })), { status: 401 });
  } finally { process.env.BLOG_ADMIN_PASSWORD = old; }
});

test('必须配置强独立签名密钥，不能自动降级', async () => {
  const old = process.env.BLOG_ADMIN_SECRET;
  try {
    delete process.env.BLOG_ADMIN_SECRET;
    await assert.rejects(() => createSession(request()), { status: 503 });
  } finally { process.env.BLOG_ADMIN_SECRET = old; }
});

test('缺少 Origin 或相同域名不同协议均拒绝', () => {
  for (const origin of [undefined, 'null', 'http://blog.test', 'https://attacker.test']) {
    assert.throws(() => assertSameOrigin(request({ origin })), { status: 403 });
  }
});

test('错误密码达到阈值后正确密码也不能绕过冷却', async () => {
  for (let i = 0; i < 10; i++) {
    const res = response(); await login({ ...request(), body: { password: 'wrong' } }, res);
    assert.equal(res.statusCode, 401);
  }
  const res = response();
  await login({ ...request(), body: { password: process.env.BLOG_ADMIN_PASSWORD } }, res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'], '900');
  assert.equal(res.headers['Set-Cookie'], undefined);
});

test('存储不可用时登录失败且不签发 Cookie', async () => {
  const old = process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const res = response(); await login({ ...request(), body: { password: process.env.BLOG_ADMIN_PASSWORD } }, res);
    assert.equal(res.statusCode, 503); assert.equal(res.headers['Set-Cookie'], undefined);
  } finally { process.env.UPSTASH_REDIS_REST_TOKEN = old; }
});

test('所有请求体路径都校验字节上限和 JSON 顶层类型', async () => {
  const object = { password: '中'.repeat(3000) }; const raw = JSON.stringify(object);
  for (const body of [object, raw, Buffer.from(raw)]) {
    await assert.rejects(() => readJsonBody({ body }, 8192), { status: 413 });
  }
  await assert.rejects(() => readJsonBody(Readable.from([Buffer.from(raw)]), 8192), { status: 413 });
  for (const body of ['null', '[]', '123', [], 123, '{bad']) {
    await assert.rejects(() => readJsonBody({ body }), { status: 400 });
  }
  assert.deepEqual(await readJsonBody({ body: '{"ok":true}' }), { ok: true });
});

test('草稿保存和删除仅访问私有存储，更新版本不会被误删', async () => {
  const input = { id: 'private-note', title: '私密草稿', date: '2026-09-22', tag: '笔记', content: '不能进入公开仓库', category: '工程' };
  const { post } = await saveDraft(input);
  assert.equal((await readDrafts())[0].content, input.content);
  assert.equal((await readDrafts())[0].seriesId, '');
  await writeDraft({ ...post, content: '另一个窗口的新内容' });
  assert.equal(await removeDraft(post), 0);
  assert.equal((await readDrafts())[0].content, '另一个窗口的新内容');
  await deleteDraft(input.id);
  assert.deepEqual(await readDrafts(), []);
});

test('旧草稿会继承已发布文章的系列归属', async (t) => {
  const { getPost } = await import('../api/_lib/posts.mjs');
  const oldDraft = {
    id: 'legacy-chapter', file: 'legacy-chapter.md', title: '旧章节', date: '2026-09-22',
    tag: '测试', category: '工程', excerpt: '', content: '正文', updatedAt: new Date().toISOString()
  };
  await writeDraft(oldDraft);
  const privateFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (url === 'https://redis.test') return privateFetch(url, init);
    const path = new URL(url).pathname;
    const data = path.includes('/contents/blog/index.json')
      ? [{ id: 'legacy-chapter', file: 'legacy-chapter.md', title: '旧章节', date: '2026-09-22', tag: '测试', category: '工程', excerpt: '' }]
      : [{ id: 'legacy-series', title: '旧系列', description: '说明', prerequisites: '', chapters: ['legacy-chapter'] }];
    return new Response(JSON.stringify({ type: 'file', content: Buffer.from(JSON.stringify(data)).toString('base64') }));
  });
  const result = await getPost('legacy-chapter');
  assert.equal(result.post.seriesId, 'legacy-series');
});

test('会话超过八小时后过期', async (t) => {
  const issued = await createSession(request());
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 9 * 60 * 60 * 1000);
  await assert.rejects(() => requireSession(request({ cookie: issued.cookie.split(';')[0] })), { status: 401 });
});

test('图片声明不能把 HTML 伪装为 PNG', async () => {
  const { uploadImage } = await import('../api/_lib/posts.mjs');
  await assert.rejects(() => uploadImage({ name: 'evil.png', type: 'image/png', data: Buffer.from('<script>alert(1)</script>').toString('base64') }), { status: 400 });
});

test('发布仅提交公开文章、索引和 sitemap；成功后才移除草稿', async (t) => {
  const { publishDraft } = await import('../api/_lib/posts.mjs');
  const input = { id: 'publish-test', title: '发布测试', date: '2026-09-22', tag: '测试', content: '正文', category: '工程' };
  await saveDraft(input);
  const privateFetch = globalThis.fetch;
  const trees = [];
  let failCommit = true;
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (url === 'https://redis.test') return privateFetch(url, init);
    assert.equal(new URL(url).hostname, 'api.github.com');
    const path = new URL(url).pathname;
    let result;
    if (path.includes('/contents/blog/index.json') || path.includes('/contents/series/index.json')) {
      result = { type: 'file', content: Buffer.from('[]').toString('base64') };
    }
    else if (path.endsWith('/git/ref/heads/main')) result = { object: { sha: 'base' } };
    else if (path.endsWith('/git/commits/base')) result = { tree: { sha: 'base-tree' } };
    else if (path.endsWith('/git/blobs')) result = { sha: 'blob' };
    else if (path.endsWith('/git/trees')) { trees.push(JSON.parse(init.body)); result = { sha: 'tree' }; }
    else if (path.endsWith('/git/commits')) result = { sha: 'commit' };
    else if (path.endsWith('/git/refs/heads/main')) {
      if (failCommit) return new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 });
      result = { object: { sha: 'commit' } };
    } else throw new Error(`不允许访问 ${path}`);
    return new Response(JSON.stringify(result));
  });
  await assert.rejects(() => publishDraft(input.id), { status: 409 });
  assert.equal((await readDrafts()).length, 1);
  failCommit = false;
  const published = await publishDraft(input.id);
  assert.equal(published.post.id, input.id);
  assert.deepEqual(await readDrafts(), []);
  assert.deepEqual(trees.at(-1).tree.map((file) => file.path), ['blog/publish-test.md', 'blog/index.json', 'sitemap.xml']);
});

test('发布系列章节会原子更新文章、系列目录和 sitemap', async (t) => {
  const { publishDraft } = await import('../api/_lib/posts.mjs');
  const input = { id: 'series-chapter', title: '系列章节', date: '2026-09-24', tag: '测试', content: '正文', category: '工程', seriesId: 'systems' };
  await saveDraft(input);
  const privateFetch = globalThis.fetch;
  const blobs = new Map();
  let tree;
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (url === 'https://redis.test') return privateFetch(url, init);
    const path = new URL(url).pathname;
    let result;
    if (path.includes('/contents/blog/index.json')) result = { type: 'file', content: Buffer.from('[]').toString('base64') };
    else if (path.includes('/contents/series/index.json')) {
      const value = [{ id: 'systems', title: '系统系列', description: '说明', prerequisites: '', chapters: [] }];
      result = { type: 'file', content: Buffer.from(JSON.stringify(value)).toString('base64') };
    } else if (path.endsWith('/git/ref/heads/main')) result = { object: { sha: 'base' } };
    else if (path.endsWith('/git/commits/base')) result = { tree: { sha: 'base-tree' } };
    else if (path.endsWith('/git/blobs')) {
      const sha = `blob-${blobs.size}`;
      blobs.set(sha, Buffer.from(JSON.parse(init.body).content, 'base64').toString('utf8'));
      result = { sha };
    } else if (path.endsWith('/git/trees')) { tree = JSON.parse(init.body); result = { sha: 'tree' }; }
    else if (path.endsWith('/git/commits')) result = { sha: 'commit' };
    else if (path.endsWith('/git/refs/heads/main')) result = { object: { sha: 'commit' } };
    else throw new Error(`不允许访问 ${path}`);
    return new Response(JSON.stringify(result));
  });

  await publishDraft(input.id);
  assert.deepEqual(tree.tree.map((file) => file.path), ['blog/series-chapter.md', 'blog/index.json', 'series/index.json', 'sitemap.xml']);
  const seriesBlob = blobs.get(tree.tree.find((file) => file.path === 'series/index.json').sha);
  assert.deepEqual(JSON.parse(seriesBlob)[0].chapters, ['series-chapter']);
  const sitemapBlob = blobs.get(tree.tree.find((file) => file.path === 'sitemap.xml').sha);
  assert.match(sitemapBlob, /series\.html\?series=systems/);
});

test('所有内容接口在未登录时拒绝访问', async () => {
  for (const [name, method] of [['posts', 'GET'], ['post', 'GET'], ['post', 'PUT'], ['publish', 'POST'], ['upload', 'POST'], ['series', 'GET'], ['series', 'PUT'], ['session', 'GET']]) {
    const { default: handler } = await import(`../api/admin/${name}.mjs`);
    const res = response();
    await handler({ ...request(), method, url: `/api/admin/${name}`, body: {} }, res);
    assert.equal(res.statusCode, 401, `${method} ${name}`);
  }
});
