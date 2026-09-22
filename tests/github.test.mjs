import test from 'node:test';
import assert from 'node:assert/strict';
import { commitFiles } from '../api/_lib/github.mjs';

process.env.BLOG_GITHUB_TOKEN = 'test-token';
process.env.BLOG_GITHUB_OWNER = 'Owner';
process.env.BLOG_GITHUB_REPO = 'Repo';
process.env.BLOG_GITHUB_BRANCH = 'main';

function reply(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('多文件文本、二进制与删除会组成一个原子 Git 提交', async () => {
  const originalFetch = globalThis.fetch;
  const blobs = [];
  let treeBody;
  let refBody;

  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method || 'GET';
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return reply({ object: { sha: 'base-commit' } });
    if (method === 'GET' && path.endsWith('/git/commits/base-commit')) return reply({ tree: { sha: 'base-tree' } });
    if (method === 'POST' && path.endsWith('/git/blobs')) {
      const body = JSON.parse(init.body);
      blobs.push(body);
      return reply({ sha: `blob-${blobs.length}` });
    }
    if (method === 'POST' && path.endsWith('/git/trees')) {
      treeBody = JSON.parse(init.body);
      return reply({ sha: 'next-tree' });
    }
    if (method === 'POST' && path.endsWith('/git/commits')) return reply({ sha: 'next-commit', html_url: 'https://example.test/commit' });
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) {
      refBody = JSON.parse(init.body);
      return reply({ object: { sha: 'next-commit' } });
    }
    throw new Error(`未处理的 GitHub API 请求：${method} ${path}`);
  };

  try {
    const binary = Buffer.from([0, 1, 254, 255]).toString('base64');
    const result = await commitFiles([
      { path: 'notes.txt', content: '中文内容' },
      { path: 'image.bin', content: binary, encoding: 'base64' },
      { path: 'old.md', content: null }
    ], 'test: atomic commit');

    assert.equal(Buffer.from(blobs[0].content, 'base64').toString('utf8'), '中文内容');
    assert.equal(blobs[1].content, binary);
    assert.equal(treeBody.base_tree, 'base-tree');
    assert.deepEqual(treeBody.tree.map((entry) => [entry.path, entry.sha]), [
      ['notes.txt', 'blob-1'],
      ['image.bin', 'blob-2'],
      ['old.md', null]
    ]);
    assert.deepEqual(refBody, { sha: 'next-commit', force: false });
    assert.equal(result.sha, 'next-commit');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
