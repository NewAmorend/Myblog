import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.mjs';
import { redis, storeKey } from './store.mjs';

const COOKIE_NAME = 'amorend_admin_session';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const digest = (value) => createHash('sha256').update(String(value)).digest();
const safeEqual = (left, right) => timingSafeEqual(digest(left), digest(right));

function configuredPassword() {
  const password = process.env.BLOG_ADMIN_PASSWORD;
  if (!password || password.length < 16 || password.startsWith('replace-')) {
    throw new HttpError(503, '请配置至少 16 位的随机后台密码');
  }
  return password;
}

function signingSecret() {
  const secret = process.env.BLOG_ADMIN_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-') || secret === configuredPassword()) {
    throw new HttpError(503, '请配置独立且至少 32 位的会话签名密钥');
  }
  // 改密码会改变签名密钥，使之前的全部会话立即失效。
  return createHmac('sha256', secret).update(configuredPassword()).digest();
}

const sign = (body) => createHmac('sha256', signingSecret()).update(body).digest('base64url');

function decodeSession(token) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra || !safeEqual(signature, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.v !== 2 || !Number.isSafeInteger(payload.exp) || payload.exp <= Date.now() ||
        !/^[A-Za-z0-9_-]{32}$/.test(payload.sid) || !/^[A-Za-z0-9_-]{32}$/.test(payload.csrf)) return null;
    return payload;
  } catch { return null; }
}

function sessionToken(request) {
  const part = String(request.headers.cookie || '').split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE_NAME}=`));
  if (!part) return '';
  try { return decodeURIComponent(part.slice(COOKIE_NAME.length + 1)); }
  catch { return ''; }
}

function secureRequest(request) {
  return request.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL === '1';
}

function serializeCookie(value, request, seconds) {
  return [`${COOKIE_NAME}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict',
    secureRequest(request) ? 'Secure' : '', `Max-Age=${seconds}`].filter(Boolean).join('; ');
}

export function verifyPassword(password) {
  return typeof password === 'string' && password.length <= 1024 && safeEqual(password, configuredPassword());
}

export async function createSession(request) {
  const payload = { v: 2, sid: randomBytes(24).toString('base64url'),
    exp: Date.now() + SESSION_TTL, csrf: randomBytes(24).toString('base64url') };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${body}.${sign(body)}`;
  await redis('SET', storeKey(`session:${payload.sid}`), '1', 'EX', SESSION_TTL / 1000);
  return { csrf: payload.csrf, expiresAt: new Date(payload.exp).toISOString(),
    cookie: serializeCookie(token, request, SESSION_TTL / 1000) };
}

export function clearSessionCookie(request) { return serializeCookie('', request, 0); }

export async function requireSession(request) {
  const payload = decodeSession(sessionToken(request));
  if (!payload || await redis('GET', storeKey(`session:${payload.sid}`)) !== '1') {
    throw new HttpError(401, '登录已失效，请重新登录');
  }
  return payload;
}

export async function revokeSession(session) {
  await redis('DEL', storeKey(`session:${session.sid}`));
}

export function assertSameOrigin(request) {
  const host = request.headers.host;
  const origin = request.headers.origin;
  const protocol = secureRequest(request) ? 'https:' : 'http:';
  try {
    const url = new URL(origin);
    if (!host || url.origin !== `${protocol}//${host}` || origin !== url.origin) throw new Error();
  } catch { throw new HttpError(403, '拒绝缺少来源或跨站请求'); }
}

export async function requireMutationSession(request) {
  assertSameOrigin(request);
  const session = await requireSession(request);
  const csrf = request.headers['x-admin-csrf'];
  if (typeof csrf !== 'string' || !safeEqual(csrf, session.csrf)) {
    throw new HttpError(403, '安全校验失败，请刷新后台后重试');
  }
  return session;
}
