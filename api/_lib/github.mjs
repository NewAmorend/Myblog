import { HttpError } from './http.mjs';

const API_ROOT = 'https://api.github.com';

function repositoryConfig() {
  const owner = process.env.BLOG_GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER || 'NewAmorend';
  const repo = process.env.BLOG_GITHUB_REPO || process.env.VERCEL_GIT_REPO_SLUG || 'Myblog';
  const branch = process.env.BLOG_GITHUB_BRANCH || 'main';
  const token = process.env.BLOG_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

  if (!token) throw new HttpError(503, '后台尚未配置 BLOG_GITHUB_TOKEN');
  return { owner, repo, branch, token };
}

function contentPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function github(path, init = {}) {
  const config = repositoryConfig();
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'amorend-blog-admin',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const status = response.status === 404 ? 404 : response.status === 409 || response.status === 422 ? 409 : 502;
    const error = new HttpError(status, status === 404 ? '仓库中的内容不存在' : 'GitHub 内容写入失败');
    error.details = payload?.message || `GitHub API ${response.status}`;
    throw error;
  }

  return payload;
}

export function getRepositorySummary() {
  const { owner, repo, branch } = repositoryConfig();
  return { owner, repo, branch };
}

export async function readRepoFile(path, optional = false) {
  const { owner, repo, branch } = repositoryConfig();
  try {
    const file = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${contentPath(path)}?ref=${encodeURIComponent(branch)}`);
    if (!file || Array.isArray(file) || file.type !== 'file') {
      throw new HttpError(422, `${path} 不是普通文件`);
    }
    return Buffer.from(String(file.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  } catch (error) {
    if (optional && error.status === 404) return null;
    throw error;
  }
}

export async function readRepoJson(path, fallback) {
  const content = await readRepoFile(path, fallback !== undefined);
  if (content === null) return fallback;
  try {
    return JSON.parse(content);
  } catch {
    throw new HttpError(502, `${path} 的 JSON 格式已损坏`);
  }
}

export async function commitFiles(changes, message) {
  if (!Array.isArray(changes) || !changes.length) throw new HttpError(400, '没有需要提交的内容');

  const { owner, repo, branch } = repositoryConfig();
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const ref = await github(`${repoPath}/git/ref/heads/${encodeURIComponent(branch)}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await github(`${repoPath}/git/commits/${baseCommitSha}`);

  const treeEntries = [];
  for (const change of changes) {
    if (!change.path || change.path.startsWith('/') || change.path.includes('..')) {
      throw new HttpError(400, '提交路径不合法');
    }

    if (change.content === null) {
      treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }

    const blob = await github(`${repoPath}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: change.encoding === 'base64'
          ? String(change.content)
          : Buffer.from(String(change.content), 'utf8').toString('base64'),
        encoding: 'base64'
      })
    });
    treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const tree = await github(`${repoPath}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries })
  });
  const commit = await github(`${repoPath}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] })
  });

  await github(`${repoPath}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  return { sha: commit.sha, url: commit.html_url || null };
}
