import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminHtmlUrl = new URL('../admin/index.html', import.meta.url);
const adminScriptUrl = new URL('../admin/admin.js', import.meta.url);

test('登录表单在脚本就绪前不会通过 GET 泄露密码', async () => {
  const html = await readFile(adminHtmlUrl, 'utf8');
  const script = await readFile(adminScriptUrl, 'utf8');

  assert.match(html, /<form[^>]+data-login-form[^>]+method="post"[^>]+action="\/api\/admin\/login"/);
  assert.match(html, /<button[^>]+type="submit"[^>]+disabled/);

  const listenerIndex = script.indexOf("elements.loginForm.addEventListener('submit'");
  const enableIndex = script.indexOf("querySelector('button[type=\"submit\"]').disabled = false");
  assert.ok(listenerIndex >= 0, '必须注册登录表单提交处理器');
  assert.ok(enableIndex > listenerIndex, '必须在注册提交处理器后启用按钮');
});

test('后台静态资源使用不受 clean URL 影响的绝对路径', async () => {
  const html = await readFile(adminHtmlUrl, 'utf8');

  assert.match(html, /href="\/admin\/admin\.css"/);
  assert.match(html, /src="\/admin\/admin\.js"/);
});

test('后台提供文章与系列两级内容管理入口', async () => {
  const html = await readFile(adminHtmlUrl, 'utf8');
  const script = await readFile(adminScriptUrl, 'utf8');

  assert.match(html, /data-library-mode="posts"/);
  assert.match(html, /data-library-mode="series"/);
  assert.match(html, /name="seriesId"/);
  assert.match(html, /data-series-form/);
  assert.match(script, /\/api\/admin\/series/);
});
