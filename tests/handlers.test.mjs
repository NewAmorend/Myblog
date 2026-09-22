import { mockStore } from './helpers/store.mjs';
mockStore();
import test from 'node:test';
import assert from 'node:assert/strict';
import login from '../api/admin/login.mjs';
import session from '../api/admin/session.mjs';
import logout from '../api/admin/logout.mjs';

process.env.BLOG_ADMIN_PASSWORD = 'handler-test-password';
process.env.BLOG_ADMIN_SECRET = 'handler-test-secret-with-at-least-32-characters';
process.env.BLOG_GITHUB_TOKEN = 'github-token-used-only-for-config-check';
process.env.BLOG_GITHUB_OWNER = 'TestOwner';
process.env.BLOG_GITHUB_REPO = 'TestRepo';

function request(method, body, headers = {}) {
  return {
    method,
    url: '/api/admin/test',
    body,
    headers: {
      host: 'amorend.test',
      origin: 'https://amorend.test',
      'x-forwarded-proto': 'https',
      ...headers
    }
  };
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    headersSent: false,
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.body = value; this.headersSent = true; }
  };
}

test('登录、读取会话和退出形成完整鉴权闭环', async () => {
  const loginResponse = response();
  await login(request('POST', { password: 'handler-test-password' }), loginResponse);
  assert.equal(loginResponse.statusCode, 200);
  assert.match(loginResponse.headers['set-cookie'], /HttpOnly/);
  const loginBody = JSON.parse(loginResponse.body);
  assert.equal(loginBody.repository.owner, 'TestOwner');
  assert.ok(loginBody.csrf);

  const cookie = loginResponse.headers['set-cookie'].split(';')[0];
  const sessionResponse = response();
  await session(request('GET', null, { cookie }), sessionResponse);
  assert.equal(sessionResponse.statusCode, 200);
  assert.equal(JSON.parse(sessionResponse.body).authenticated, true);

  const logoutResponse = response();
  await logout(request('POST', null, { cookie, 'x-admin-csrf': loginBody.csrf }), logoutResponse);
  assert.equal(logoutResponse.statusCode, 200);
  assert.match(logoutResponse.headers['set-cookie'], /Max-Age=0/);
});

test('错误密码不会建立会话', async () => {
  const result = response();
  await login(request('POST', { password: 'incorrect' }), result);
  assert.equal(result.statusCode, 401);
  assert.equal(result.headers['set-cookie'], undefined);
});
