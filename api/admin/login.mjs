import { limitLogin } from '../_lib/store.mjs';
import { assertSameOrigin, createSession, verifyPassword } from '../_lib/auth.mjs';
import { getRepositorySummary } from '../_lib/github.mjs';
import { allowMethods, HttpError, readJsonBody, runApi, sendJson } from '../_lib/http.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  await runApi(response, async () => {
    assertSameOrigin(request);
    const body = await readJsonBody(request, 8 * 1024);
    await limitLogin();
    if (!verifyPassword(body.password)) throw new HttpError(401, '密码不正确');
    const repository = getRepositorySummary();
    const session = await createSession(request);
    response.setHeader('Set-Cookie', session.cookie);
    sendJson(response, 200, {
      ok: true,
      csrf: session.csrf,
      expiresAt: session.expiresAt,
      repository
    });
  });
}
