import { requireMutationSession, revokeSession, clearSessionCookie } from '../_lib/auth.mjs';
import { allowMethods, runApi, sendJson } from '../_lib/http.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  await runApi(response, async () => {
    const session = await requireMutationSession(request);
    await revokeSession(session);
    response.setHeader('Set-Cookie', clearSessionCookie(request));
    sendJson(response, 200, { ok: true });
  });
}
