import { beforeEach } from 'node:test';

export function mockStore() {
  beforeEach((t) => {
    process.env.BLOG_STORAGE_NAMESPACE = 'test';
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
    const values = new Map();
    const hashes = new Map();
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      if (url !== 'https://redis.test') throw new Error('测试不允许外部网络');
      const [cmd, ...args] = JSON.parse(init.body);
      let result;
      if (cmd === 'SET') { values.set(args[0], args[1]); result = 'OK'; }
      else if (cmd === 'GET') result = values.get(args[0]) ?? null;
      else if (cmd === 'DEL') result = Number(values.delete(args[0]));
      else if (cmd === 'HVALS') result = [...(hashes.get(args[0]) || new Map()).values()];
      else if (cmd === 'HSET') {
        const hash = hashes.get(args[0]) || new Map();
        hash.set(args[1], args[2]); hashes.set(args[0], hash); result = 1;
      } else if (cmd === 'EVAL' && args[0].includes('INCR')) {
        const key = args[2]; result = (values.get(key) || 0) + 1; values.set(key, result);
      } else if (cmd === 'EVAL' && args[0].includes('HDEL')) {
        const hash = hashes.get(args[2]);
        result = hash?.get(args[3]) === args[4] ? Number(hash.delete(args[3])) : 0;
      } else throw new Error(`未实现的测试存储操作 ${cmd}`);
      return new Response(JSON.stringify({ result }));
    });
  });
}
