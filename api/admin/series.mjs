import { requireMutationSession, requireSession } from '../_lib/auth.mjs';
import { allowMethods, HttpError, readJsonBody, requestUrl, runApi, sendJson } from '../_lib/http.mjs';
import { getSeries, listSeries, publishSeries, unpublishSeries } from '../_lib/series.mjs';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['GET', 'PUT', 'DELETE'])) return;
  await runApi(response, async () => {
    if (request.method === 'GET') {
      await requireSession(request);
      const id = requestUrl(request).searchParams.get('id');
      sendJson(response, 200, id ? { series: await getSeries(id) } : { series: await listSeries() });
      return;
    }
    await requireMutationSession(request);
    const body = await readJsonBody(request, 128 * 1024);
    if (request.method === 'PUT') {
      sendJson(response, 200, await publishSeries(body.series));
      return;
    }
    if (!body.id) throw new HttpError(400, '缺少系列 ID');
    sendJson(response, 200, await unpublishSeries(body.id));
  });
}
