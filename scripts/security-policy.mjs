import { readFile, writeFile } from 'node:fs/promises';

export const policy = "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; media-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";

if (process.argv[1]?.endsWith('security-policy.mjs')) {
  for (const path of ['index.html', 'blog.html', 'article.html', 'admin/index.html']) {
    let html = await readFile(path, 'utf8');
    html = html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/g, '');
    html = html.replace(/(<meta charset="UTF-8">)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`);
    await writeFile(path, html);
  }
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const headers = config.headers[0].headers;
  config.headers[0].headers = headers.filter((item) => item.key !== 'Content-Security-Policy');
  config.headers[0].headers.push({ key: 'Content-Security-Policy', value: `${policy}; frame-ancestors 'none'` });
  await writeFile('vercel.json', JSON.stringify(config, null, 2) + '\n');
}
