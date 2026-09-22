import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = {
  'node_modules/marked/lib/marked.umd.js': 'assets/vendor/marked.js',
  'node_modules/marked/LICENSE': 'assets/vendor/marked.LICENSE.md',
  'node_modules/dompurify/dist/purify.min.js': 'assets/vendor/purify.min.js',
  'node_modules/dompurify/LICENSE': 'assets/vendor/dompurify.LICENSE',
  'node_modules/mathjax/es5/tex-svg-full.js': 'assets/vendor/mathjax/tex-svg-full.js',
  'node_modules/mathjax/es5/ui/safe.js': 'assets/vendor/mathjax/ui/safe.js',
  'node_modules/mathjax/LICENSE': 'assets/vendor/mathjax/LICENSE'
};
const hashes = {};
for (const [source, target] of Object.entries(files)) {
  await mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true });
  await copyFile(source, target);
  hashes[target] = createHash('sha256').update(await readFile(target)).digest('hex');
}
const { dependencies } = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile('assets/vendor/manifest.json', JSON.stringify({ dependencies, sha256: hashes }, null, 2) + '\n');
