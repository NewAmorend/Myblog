import { requireSession } from '../_lib/auth.mjs';
import { getAnalytics } from '../_lib/analytics.mjs';
import { allowMethods, requestUrl, runApi, sendJson } from '../_lib/http.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  await runApi(response, async () => {
    await requireSession(request);
    const days = requestUrl(request).searchParams.get('days') ?? '7';
    sendJson(response, 200, await getAnalytics(days));
  });
}
