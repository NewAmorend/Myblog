import { requireSession } from '../_lib/auth.mjs';
import { allowMethods, runApi, sendJson } from '../_lib/http.mjs';
import { listPosts } from '../_lib/posts.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['GET'])) return;
  await runApi(response, async () => {
    await requireSession(request);
    sendJson(response, 200, { posts: await listPosts() });
  });
}
