import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openLocalStore } from './local-store.mjs';
import { configureLocalStore } from '../api/_lib/store.mjs';
import { verifyPassword } from '../api/_lib/auth.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(resolve(root, '.env.local')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const port = Number(process.env.BLOG_LOCAL_PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('本机端口配置无效');
const host = `127.0.0.1:${port}`;
const origin = `http://${host}`;
// 本机 HTTP 不采用线上代理标记；只监听回环地址。
delete process.env.VERCEL;
process.env.BLOG_STORAGE_NAMESPACE = 'amorend-local';
if (!verifyPassword(process.env.BLOG_ADMIN_PASSWORD)) throw new Error('请在 .env.local 配置后台密码');
if (!process.env.BLOG_ADMIN_SECRET || process.env.BLOG_ADMIN_SECRET.length < 32) throw new Error('请配置独立的会话密钥');

if (!process.env.BLOG_GITHUB_TOKEN && !process.env.GITHUB_TOKEN) {
  try {
    const { stdout } = await promisify(execFile)('gh', ['auth', 'token', '--hostname', 'github.com'], { timeout: 10000 });
    process.env.BLOG_GITHUB_TOKEN = stdout.trim();
  } catch {
    console.error('请先运行 gh auth login 登录 GitHub，再启动后台。');
    process.exit(1);
  }
}

const handlers = new Map();
for (const name of ['login','logout','session','posts','post','publish','upload','series']) {
  handlers.set(`/api/admin/${name}`, (await import(`../api/admin/${name}.mjs`)).default);
}
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'};
const staticRoots = await Promise.all(['admin','assets'].map((name) => realpath(resolve(root,name))));
let store;
const server = createServer(async (request,response) => {
  response.setHeader('Cache-Control','no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('X-Frame-Options','DENY');
  response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy','same-origin');
  if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== origin) || request.headers['sec-fetch-site'] === 'cross-site') {
    response.writeHead(403);response.end('拒绝非本机来源请求');return;
  }
  delete request.headers['x-forwarded-proto'];
  try {
    const url = new URL(request.url,origin);
    if (handlers.has(url.pathname)) { await handlers.get(url.pathname)(request,response);return; }
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405);response.end();return; }
    if (url.pathname === '/' || url.pathname === '/admin') { response.writeHead(302,{Location:'/admin/'});response.end();return; }
    // 后台的查看博客与已发布文章链接指向正式站点。
    if (['/index.html','/blog.html','/article.html','/series.html'].includes(url.pathname)) {
      response.writeHead(302,{Location:`https://amorend.top${url.pathname}${url.search}`});response.end();return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.split('/').some((part)=>part.startsWith('.')) || !/^\/(admin|assets)\//.test(pathname)) { response.writeHead(404);response.end();return; }
    const file = await realpath(resolve(root,`.${pathname === '/admin/' ? '/admin/index.html' : pathname}`));
    if (!staticRoots.some((base)=>file.startsWith(base+sep)) || !types[extname(file)]) { response.writeHead(404);response.end();return; }
    const content = await readFile(file);
    response.setHeader('Content-Type',types[extname(file)]);
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.statusCode = error.code === 'ENOENT' || error instanceof URIError ? 404 : 500;
    response.end(response.statusCode === 404 ? '页面不存在' : '本机后台暂时无法完成请求');
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.on('error',(error)=>{
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已占用，后台可能已经启动：${origin}/admin/` : '本机后台启动失败');
  store?.close();process.exit(1);
});
server.listen(port,'127.0.0.1',()=>{
  store = openLocalStore(resolve(root,'.blog-admin','local.sqlite'));
  configureLocalStore(store.command);
  console.log(`本机写作后台：${origin}/admin/`);
  console.log('草稿保存在本机。读取已发布文章、发布和上传图片需要联网。按 Ctrl+C 关闭后台。');
});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{store?.close();process.exit(0);}));
