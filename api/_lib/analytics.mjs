import { createHash } from 'node:crypto';
import { HttpError } from './http.mjs';

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const DAY = 86_400_000;
const cache = new Map();
const query = `query BlogTraffic($zone: string, $start: Date, $end: Date) {
  viewer { zones(filter: {zoneTag: $zone}) {
    httpRequests1dGroups(limit: 31, orderBy: [date_ASC], filter: {date_geq: $start, date_lt: $end}) {
      dimensions { date }
      sum { requests pageViews bytes cachedRequests
        countryMap { clientCountryName requests }
        browserMap { uaBrowserFamily pageViews }
      }
      uniq { uniques }
    }
  } }
}`;

export function analyticsRange(days = 7, now = new Date()) {
  if (!['7', '30'].includes(String(days))) throw new HttpError(400, '统计范围只能是 7 天或 30 天');
  const endTime = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return {
    days: Number(days),
    start: new Date(endTime - Number(days) * DAY).toISOString().slice(0, 10),
    end: new Date(endTime - DAY).toISOString().slice(0, 10),
    until: new Date(endTime).toISOString().slice(0, 10)
  };
}

const number = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

export function summarizeAnalytics(rows, range) {
  const byDate = new Map(rows.map((row) => [row.dimensions?.date, row]));
  const countries = new Map();
  const browsers = new Map();
  const totals = { pageViews: 0, requests: 0, bytes: 0, cachedRequests: 0, dailyUniqueIPs: 0 };
  const daily = Array.from({ length: range.days }, (_, index) => {
    const date = new Date(Date.parse(`${range.start}T00:00:00Z`) + index * DAY).toISOString().slice(0, 10);
    const row = byDate.get(date);
    const sum = row?.sum || {};
    const entry = { date, pageViews: number(sum.pageViews), requests: number(sum.requests), bytes: number(sum.bytes), uniqueIPs: number(row?.uniq?.uniques) };
    totals.pageViews += entry.pageViews;
    totals.requests += entry.requests;
    totals.bytes += entry.bytes;
    totals.cachedRequests += number(sum.cachedRequests);
    // 跨天独立 IP 不能相加当作整个周期的去重访客，只用于计算日均值。
    totals.dailyUniqueIPs += entry.uniqueIPs;
    for (const item of sum.countryMap || []) {
      const name = String(item.clientCountryName || '未知地区');
      countries.set(name, (countries.get(name) || 0) + number(item.requests));
    }
    for (const item of sum.browserMap || []) {
      const name = String(item.uaBrowserFamily || '未知浏览器');
      browsers.set(name, (browsers.get(name) || 0) + number(item.pageViews));
    }
    return entry;
  });
  const ranking = (map) => [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  return { totals, daily, countries: ranking(countries), browsers: ranking(browsers) };
}

export async function getAnalytics(days = 7) {
  const range = analyticsRange(days);
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) return { configured: false };
  if (!/^[a-f0-9]{32}$/i.test(zone)) throw new HttpError(503, 'Cloudflare Zone ID 格式不正确，请检查后台配置');
  const key = createHash('sha256').update(`${token}:${zone}:${range.start}:${range.until}`).digest('hex');
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { zone, start: range.start, end: range.until } }),
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    throw new HttpError(502, '无法连接 Cloudflare，请稍后重试');
  }
  // 不向浏览器回传上游错误正文，避免泄露账户与查询配置。
  if (response.status === 401 || response.status === 403) throw new HttpError(502, 'Cloudflare 拒绝访问，请检查 Token 的统计读取权限与域名范围');
  if (response.status === 429) throw new HttpError(502, 'Cloudflare 请求过于频繁，请稍后再刷新');
  if (!response.ok) throw new HttpError(502, 'Cloudflare 统计服务暂时不可用');
  const payload = await response.json().catch(() => null);
  if (!payload || payload.errors?.length) throw new HttpError(502, 'Cloudflare 查询失败，请检查 Token 权限、Zone ID 以及套餐支持的时间范围');
  const zones = payload.data?.viewer?.zones;
  if (!Array.isArray(zones) || zones.length !== 1 || !Array.isArray(zones[0].httpRequests1dGroups)) {
    throw new HttpError(502, '未能读取 Cloudflare 域名统计，请检查 Zone ID 与 Token 授权范围');
  }
  const data = {
    configured: true, source: 'cloudflare-zone', timezone: 'UTC',
    start: range.start, end: range.end, fetchedAt: new Date().toISOString(),
    ...summarizeAnalytics(zones[0].httpRequests1dGroups, range)
  };
  if (cache.size >= 8) cache.clear();
  cache.set(key, { data, expires: Date.now() + 60_000 });
  return data;
}
