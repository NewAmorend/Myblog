import { requireMutationSession } from '../_lib/auth.mjs';
import { allowMethods, readJsonBody, runApi, sendJson } from '../_lib/http.mjs';
import { uploadImage } from '../_lib/posts.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  await runApi(response, async () => {
    await requireMutationSession(request);
    const body = await readJsonBody(request);
    sendJson(response, 201, await uploadImage(body));
  });
}
