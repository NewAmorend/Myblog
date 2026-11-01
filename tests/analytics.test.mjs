import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsRange, summarizeAnalytics, getAnalytics } from '../api/_lib/analytics.mjs';

const zone = 'a'.repeat(32);
function setEnv(t, name, value) {
  const previous = process.env[name];
  process.env[name] = value;
  t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
}
function configure(t) {
  setEnv(t, 'CLOUDFLARE_API_TOKEN', `test-token-${crypto.randomUUID()}`);
  setEnv(t, 'CLOUDFLARE_ZONE_ID', zone);
}

test('时间范围使用完整 UTC 自然日，跨月准确，拒绝任意查询范围', () => {
  assert.deepEqual(analyticsRange('7', new Date('2026-11-01T02:00:00+08:00')), {
    days: 7, start: '2026-10-24', end: '2026-10-30', until: '2026-10-31'
  });
  for (const value of ['0', '8', '365', '7 or 1=1', '']) assert.throws(() => analyticsRange(value), { status: 400 });
});

test('汇总补齐无请求日期，独立 IP 只用于日均，地区与浏览器按数值合并', () => {
  const range = analyticsRange(7, new Date('2026-10-27T00:00:00Z'));
  const rows = [20, 22].map((day) => ({ dimensions: { date: `2026-10-${day}` }, sum: {
    pageViews: 10, requests: 30, bytes: 1024, cachedRequests: 15,
    countryMap: [{ clientCountryName: 'CN', requests: 20 }, { clientCountryName: 'US', requests: 10 }],
    browserMap: [{ uaBrowserFamily: 'Firefox', pageViews: 10 }]
  }, uniq: { uniques: 5 } }));
  const result = summarizeAnalytics(rows, range);
  assert.equal(result.daily.length, 7);
  assert.equal(result.daily[1].pageViews, 0);
  assert.equal(result.totals.pageViews, 20);
  assert.equal(result.totals.dailyUniqueIPs, 10);
  assert.equal(result.totals.requests, 60);
  assert.equal(result.totals.bytes, 2048);
  assert.deepEqual(result.countries, [{ name: 'CN', value: 40 }, { name: 'US', value: 20 }]);
  assert.deepEqual(result.browsers, [{ name: 'Firefox', value: 20 }]);
});

test('未配置时不访问网络，不把未接入伪装成零访问', async (t) => {
  setEnv(t, 'CLOUDFLARE_API_TOKEN', '');
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('不应发出请求'); });
  assert.deepEqual(await getAnalytics(), { configured: false });
  assert.equal(fetch.mock.callCount(), 0);
});

test('只向 Cloudflare 固定端点发送服务端 Token，按范围缓存且响应不含密钥', async (t) => {
  configure(t);
  let count = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    count++;
    assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
    assert.equal(options.headers.Authorization, `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`);
    const body = JSON.parse(options.body);
    assert.equal(body.variables.zone, zone);
    assert.match(body.query, /httpRequests1dGroups/);
    assert.ok(options.signal);
    return Response.json({ data: { viewer: { zones: [{ httpRequests1dGroups: [] }] } } });
  });
  const first = await getAnalytics(7);
  await getAnalytics(7);
  assert.equal(count, 1);
  await getAnalytics(30);
  assert.equal(count, 2);
  assert.equal(first.configured, true);
  assert.equal(first.daily.length, 7);
  assert.equal(first.totals.pageViews, 0);
  assert.ok(!JSON.stringify(first).includes(process.env.CLOUDFLARE_API_TOKEN));
});

test('GraphQL 部分失败、无权限、域名缺失和错误响应均不返回成功统计或泄露上游正文', async (t) => {
  configure(t);
  const bodies = [
    { errors: [{ message: 'secret-token 统计权限不足' }], data: { viewer: { zones: [] } } },
    { data: { viewer: { zones: [] } } },
    { data: { viewer: { zones: [{}] } } }
  ];
  for (const body of bodies) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(() => getAnalytics(), (error) => error.status === 502 && !error.message.includes('secret-token'));
    mock.mock.restore();
  }
  for (const status of [403, 429, 500]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response('secret-token', { status }));
    await assert.rejects(() => getAnalytics(), (error) => error.status === 502 && !error.message.includes('secret-token'));
    mock.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('网络超时 secret-token'); });
  await assert.rejects(() => getAnalytics(), (error) => error.status === 502 && !error.message.includes('secret-token'));
});
