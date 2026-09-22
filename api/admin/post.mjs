import { requireMutationSession, requireSession } from '../_lib/auth.mjs';
import { allowMethods, HttpError, readJsonBody, requestUrl, runApi, sendJson } from '../_lib/http.mjs';
import { deleteDraft, getPost, saveDraft, unpublishPost } from '../_lib/posts.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'PUT', 'DELETE'])) return;
  await runApi(response, async () => {
    if (request.method === 'GET') {
      await requireSession(request);
      const id = requestUrl(request).searchParams.get('id');
      if (!id) throw new HttpError(400, '缺少文章 ID');
      sendJson(response, 200, await getPost(id));
      return;
    }

    await requireMutationSession(request);
    const body = await readJsonBody(request);
    if (request.method === 'PUT') {
      sendJson(response, 200, await saveDraft(body.post));
      return;
    }

    if (!body.id) throw new HttpError(400, '缺少文章 ID');
    if (body.kind === 'draft') {
      sendJson(response, 200, await deleteDraft(body.id));
      return;
    }
    if (body.kind === 'published') {
      sendJson(response, 200, await unpublishPost(body.id));
      return;
    }
    throw new HttpError(400, '删除类型不正确');
  });
}
