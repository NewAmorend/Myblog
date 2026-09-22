import { HttpError } from './http.mjs';

export function storeKey(suffix) {
  const namespace = process.env.BLOG_STORAGE_NAMESPACE;
  if (!namespace || !/^[a-zA-Z0-9:_-]{1,100}$/.test(namespace)) {
    throw new HttpError(503, '请配置独立的 BLOG_STORAGE_NAMESPACE');
  }
  return `blog:${namespace}:${suffix}`;
}

// 私有持久化存储故障时拒绝请求，不能退化为进程内状态。
export async function redis(...command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !/^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url)) {
    throw new HttpError(503, '请配置私有 Redis 存储');
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error('存储请求失败');
    const body = await response.json();
    if (body.error || !Object.hasOwn(body, 'result')) throw new Error('存储响应错误');
    return body.result;
  } catch {
    throw new HttpError(503, '私有存储暂不可用，请稍后重试');
  }
}

export async function readDrafts() {
  const values = await redis('HVALS', storeKey('drafts'));
  if (!Array.isArray(values)) throw new HttpError(503, '草稿存储响应错误');
  return values.map((value) => JSON.parse(value));
}

export async function writeDraft(draft) {
  await redis('HSET', storeKey('drafts'), draft.id, JSON.stringify(draft));
}

// 只删除本次读取的版本，保留另一个窗口刚保存的新内容。
export async function removeDraft(draft) {
  return redis('EVAL', "if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then return redis.call('HDEL', KEYS[1], ARGV[1]) else return 0 end", 1,
    storeKey('drafts'), draft.id, JSON.stringify(draft));
}

export async function limitLogin() {
  // 单管理员账户统一限速，避免伪造 IP 或分布式来源绕过；窗口过期后自动恢复。
  const result = await redis('EVAL', "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n", 1,
    storeKey('login-attempts'), 900);
  if (!Number.isInteger(result) || result < 1) throw new HttpError(503, '登录限速暂不可用');
  if (result > 10) throw new HttpError(429, '登录尝试过多，请 15 分钟后重试');
}
