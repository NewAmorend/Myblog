import { requireSession } from '../_lib/auth.mjs';
import { getRepositorySummary } from '../_lib/github.mjs';
import { allowMethods, runApi, sendJson } from '../_lib/http.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  await runApi(response, async () => {
    const session = await requireSession(request);
    sendJson(response, 200, {
      authenticated: true,
      csrf: session.csrf,
      expiresAt: new Date(session.exp).toISOString(),
      repository: getRepositorySummary()
    });
  });
}
