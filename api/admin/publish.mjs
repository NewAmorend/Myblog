import { requireMutationSession } from '../_lib/auth.mjs';
import { allowMethods, HttpError, readJsonBody, runApi, sendJson } from '../_lib/http.mjs';
import { publishDraft } from '../_lib/posts.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  await runApi(response, async () => {
    await requireMutationSession(request);
    const body = await readJsonBody(request, 8 * 1024);
    if (!body.id) throw new HttpError(400, '缺少文章 ID');
    sendJson(response, 200, await publishDraft(body.id));
  });
}
