import { mockStore } from './helpers/store.mjs';
mockStore();
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSameOrigin,
  createSession,
  requireMutationSession,
  requireSession,
  verifyPassword
} from '../api/_lib/auth.mjs';

process.env.BLOG_ADMIN_PASSWORD = 'a-long-test-password';
process.env.BLOG_ADMIN_SECRET = 'a-separate-test-signing-secret-with-32-characters';

function request(headers = {}) {
  return {
    headers: {
      host: 'amorend.test',
      origin: 'https://amorend.test',
      'x-forwarded-proto': 'https',
      ...headers
    }
  };
}

test('密码使用常量时间摘要比较', () => {
  assert.equal(verifyPassword('a-long-test-password'), true);
  assert.equal(verifyPassword('wrong-password'), false);
});

test('创建的会话可以从 HttpOnly Cookie 还原', async () => {
  const initialRequest = request();
  const created = await createSession(initialRequest);
  assert.match(created.cookie, /HttpOnly/);
  assert.match(created.cookie, /SameSite=Strict/);
  assert.match(created.cookie, /Secure/);

  const cookie = created.cookie.split(';')[0];
  const restored = await requireSession(request({ cookie }));
  assert.equal(restored.csrf, created.csrf);
});

test('写操作同时校验同源和 CSRF token', async () => {
  const created = await createSession(request());
  const cookie = created.cookie.split(';')[0];
  await assert.doesNotReject(() => requireMutationSession(request({ cookie, 'x-admin-csrf': created.csrf })));
  await assert.rejects(() => requireMutationSession(request({ cookie, 'x-admin-csrf': 'wrong' })), /安全校验失败/);
  assert.throws(() => assertSameOrigin(request({ origin: 'https://attacker.test' })), /跨站/);
});
