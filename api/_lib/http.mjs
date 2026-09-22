export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

export function sendJson(response, status, payload, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  Object.entries(extraHeaders).forEach(([name, value]) => response.setHeader(name, value));
  response.end(JSON.stringify(payload));
}

export function allowMethods(request, response, methods) {
  if (methods.includes(request.method)) return true;
  response.setHeader('Allow', methods.join(', '));
  sendJson(response, 405, { error: '不支持这个请求方法' });
  return false;
}

export async function readJsonBody(request, limit = 6 * 1024 * 1024) {
  const validate = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, '请求内容必须是 JSON 对象');
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > limit) throw new HttpError(413, '请求内容过大');
    return body;
  };
  const parse = (raw) => {
    if (Buffer.byteLength(raw, 'utf8') > limit) throw new HttpError(413, '请求内容过大');
    let body;
    try { body = JSON.parse(raw); }
    catch { throw new HttpError(400, '请求内容不是有效的 JSON'); }
    return validate(body);
  };
  if (request.body !== undefined) {
    if (Buffer.isBuffer(request.body)) return parse(request.body.toString('utf8'));
    if (typeof request.body === 'string') return parse(request.body);
    return validate(request.body);
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, '请求内容过大');
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  return parse(Buffer.concat(chunks).toString('utf8'));
}

export function requestUrl(request) {
  const host = request.headers.host || 'localhost';
  return new URL(request.url || '/', `https://${host}`);
}

export async function runApi(response, operation) {
  try {
    await operation();
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.expose || status < 500
      ? error.message
      : '服务器暂时无法完成请求';

    if (status >= 500) console.error('API 请求失败', { status, name: error?.name });
    if (status === 429) response.setHeader('Retry-After', '900');
    if (!response.headersSent) {
      sendJson(response, status, {
        error: message,
        ...(error?.details ? { details: error.details } : {})
      });
    } else {
      response.end();
    }
  }
}
