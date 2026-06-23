#!/usr/bin/env node
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { constants, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blogDir = join(repoRoot, 'blog');
const blogIndexPath = join(blogDir, 'index.json');
const obsidianAssetDir = join(repoRoot, 'assets', 'blog', 'obsidian');
const sitemapScript = join(repoRoot, 'scripts', 'build-sitemap.mjs');

function usage() {
  console.log(`用法:
  node scripts/publish-obsidian-post.mjs <obsidian-url-or-md-path> [options]

常用:
  node scripts/publish-obsidian-post.mjs 'obsidian://open?vault=Obsidian%20Vault&file=Agent中的上下文管理--offload'
  node scripts/publish-obsidian-post.mjs 'obsidian://open?...' --tag AI-Agent --publish

选项:
  --title <title>       覆盖文章标题
  --date <YYYY-MM-DD>   覆盖发布日期，默认使用源文件修改日期
  --tag <tag>           覆盖标签，默认按标题粗略推断
  --category <category> 覆盖分类（求职/博客/工程），默认工程
  --id <slug>           覆盖 URL slug
  --excerpt <text>      覆盖摘要，默认取正文第一段
  --vault-path <path>   指定 Obsidian vault 路径
  --dry-run             只预览，不写文件
  --commit              导入后自动 git add + commit
  --publish             导入前 pull --rebase，导入后 commit + push
  --message <text>      覆盖提交信息
  --help                显示帮助
`);
}

function parseArgs(argv) {
  const result = { source: '', options: {} };
  const optionsWithValue = new Set(['--title', '--date', '--tag', '--category', '--id', '--excerpt', '--vault-path', '--message']);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      result.options.help = true;
      continue;
    }

    if (arg === '--dry-run') {
      result.options.dryRun = true;
      continue;
    }

    if (arg === '--commit') {
      result.options.commit = true;
      continue;
    }

    if (arg === '--publish') {
      result.options.publish = true;
      result.options.commit = true;
      continue;
    }

    if (optionsWithValue.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} 需要一个值`);
      }
      result.options[arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`未知选项：${arg}`);
    }

    if (!result.source) {
      result.source = arg;
      continue;
    }

    throw new Error(`只能传入一个 Obsidian 链接或 Markdown 路径，多余参数：${arg}`);
  }

  return result;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function decodeObsidianUrl(input) {
  if (!input.startsWith('obsidian://')) return null;
  const url = new URL(input);
  return {
    vault: url.searchParams.get('vault') || '',
    file: url.searchParams.get('file') || ''
  };
}

async function resolveVaultPath(vaultName, explicitVaultPath) {
  if (explicitVaultPath) return resolve(explicitVaultPath);
  if (!vaultName) throw new Error('Obsidian 链接里缺少 vault 参数，请加 --vault-path 指定 vault 路径');

  const configPath = join(homedir(), 'Library', 'Application Support', 'obsidian', 'obsidian.json');
  if (await exists(configPath)) {
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    const vaults = Object.values(config.vaults || {});
    const matched = vaults.find((vault) => basename(vault.path) === vaultName);
    if (matched?.path) return matched.path;
  }

  return join(homedir(), 'Documents', vaultName);
}

async function resolveSource(input, explicitVaultPath) {
  const obsidian = decodeObsidianUrl(input);
  if (!obsidian) return resolve(input);

  const vaultPath = await resolveVaultPath(obsidian.vault, explicitVaultPath);
  if (!obsidian.file) throw new Error('Obsidian 链接里缺少 file 参数');

  const rawFile = obsidian.file.endsWith('.md') ? obsidian.file : `${obsidian.file}.md`;
  const sourcePath = join(vaultPath, rawFile);
  if (await exists(sourcePath)) return sourcePath;

  throw new Error(`找不到 Obsidian 文件：${sourcePath}`);
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, content: markdown };

  const data = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const colon = line.indexOf(':');
    if (colon === -1) return;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) data[key] = value;
  });

  return { data, content: markdown.slice(match[0].length) };
}

function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function titleFromFileName(sourcePath) {
  return basename(sourcePath, '.md')
    .replace(/--+/g, '：')
    .replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, '$1 $2')
    .replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function applySlugDictionary(value) {
  const replacements = [
    [/上下文/g, ' context '],
    [/管理/g, ' management '],
    [/中的/g, ' '],
    [/智能体/g, ' agent '],
    [/代理/g, ' agent '],
    [/推荐系统/g, ' recommendation system '],
    [/推荐/g, ' recommendation '],
    [/指标/g, ' metrics '],
    [/工作原理/g, ' ranking '],
    [/排序/g, ' ranking '],
    [/轨迹/g, ' trajectory '],
    [/基本介绍/g, ' introduction '],
    [/基本概念/g, ' basics '],
    [/计算机网络/g, ' computer networks '],
    [/持续学习/g, ' continual learning '],
    [/技能/g, ' skills '],
    [/产出/g, ' production '],
    [/医学影像/g, ' medical imaging '],
    [/微调/g, ' finetuning '],
    [/大语言模型/g, ' llm '],
    [/知识增强/g, ' knowledge enhanced '],
    [/视觉问答/g, ' vqa '],
    [/病理/g, ' pathology '],
    [/自进化/g, ' self evolving '],
    [/去噪/g, ' denoising '],
    [/抗干扰/g, ' robust '],
    [/常见范式/g, ' paradigms '],
    [/思考/g, ' notes ']
  ];

  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function slugify(value) {
  const withDictionary = applySlugDictionary(value);
  const slug = withDictionary
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || `post-${Date.now()}`;
}

function inferTag(title) {
  if (/rag|检索|推荐/i.test(title)) return 'RAG';
  if (/network|tcp|ip|网络/i.test(title)) return 'Computer-Networks';
  if (/continual|持续学习/i.test(title)) return 'Continual-Learning';
  if (/harness|claude/i.test(title)) return 'Harness';
  if (/agent|offload|上下文/i.test(title)) return 'AI-Agent';
  return 'Notes';
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\(([^)]+)\)/g, (_, url) => url)
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferExcerpt(content) {
  const lines = content.split(/\r?\n/);
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length) break;
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) continue;
    if (/^```/.test(trimmed)) continue;
    if (/^\|?[-: ]+\|[-|: ]+$/.test(trimmed)) continue;
    current.push(trimmed);
  }

  const text = stripMarkdown(current.join(' '));
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function demoteHeadings(markdown, title) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  let removedTitle = false;

  return lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }

    if (inFence) return line;

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (!heading) return line;

    const text = heading[2].trim();
    if (!removedTitle && text === title) {
      removedTitle = true;
      return '';
    }

    const level = Math.min(6, heading[1].length + 1);
    return `${'#'.repeat(level)} ${text}`;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function walkFiles(root) {
  const result = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.obsidian' || entry.name === '.trash') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        result.push(fullPath);
      }
    }
  }
  await walk(root);
  return result;
}

function isImagePath(value) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(value);
}

async function buildAssetIndex(vaultRoot) {
  const files = await walkFiles(vaultRoot);
  const index = new Map();
  files.filter(isImagePath).forEach((file) => {
    index.set(basename(file).toLowerCase(), file);
    index.set(relative(vaultRoot, file).replace(/\\/g, '/').toLowerCase(), file);
  });
  return index;
}

async function convertObsidianEmbeds(content, sourcePath, slug, dryRun) {
  const vaultRoot = await findVaultRoot(sourcePath);
  const assetIndex = await buildAssetIndex(vaultRoot);
  const copiedAssets = [];
  let imageCounter = 0;
  let converted = content;

  for (const match of [...content.matchAll(/!\[\[([^|\]]+)(?:\|([^\]]+))?]]/g)]) {
    const rawTarget = match[1].trim();
    const altText = (match[2] || rawTarget.replace(/\.[^.]+$/, '')).trim();
    const key = rawTarget.replace(/\\/g, '/').toLowerCase();
    const imagePath = assetIndex.get(key) || assetIndex.get(basename(rawTarget).toLowerCase());

    if (!imagePath) {
      converted = converted.replace(match[0], `**缺失图片：${rawTarget}**`);
      continue;
    }

    imageCounter += 1;
    const extension = extname(imagePath).toLowerCase();
    const outputName = `${slug}-${String(imageCounter).padStart(2, '0')}${extension}`;
    const outputPath = join(obsidianAssetDir, outputName);
    const markdownPath = `assets/blog/obsidian/${outputName}`;

    copiedAssets.push(outputPath);
    if (!dryRun) {
      await mkdir(obsidianAssetDir, { recursive: true });
      await copyFile(imagePath, outputPath);
    }

    converted = converted.replace(match[0], `![${altText}](${markdownPath})`);
  }

  return { content: converted, copiedAssets };
}

async function findVaultRoot(sourcePath) {
  let current = dirname(sourcePath);
  while (current !== dirname(current)) {
    if (existsSync(join(current, '.obsidian'))) return current;
    current = dirname(current);
  }
  return dirname(sourcePath);
}

function convertInternalLinks(content, posts) {
  const byTitle = new Map(posts.map((post) => [post.title, post]));
  const byFile = new Map(posts.map((post) => [basename(post.file, '.md'), post]));
  const byId = new Map(posts.map((post) => [post.id, post]));

  return content.replace(/\[\[([^|\]#]+)(?:#[^|\]]+)?(?:\|([^\]]+))?]]/g, (match, rawTarget, rawLabel) => {
    const target = rawTarget.trim();
    const label = (rawLabel || target).trim();
    const post = byTitle.get(target) || byFile.get(target) || byId.get(target);
    if (!post) return label;
    return `[${label}](article.html?post=${post.id})`;
  });
}

async function readBlogIndex() {
  return JSON.parse(await readFile(blogIndexPath, 'utf8'));
}

async function writeBlogIndex(posts) {
  await writeFile(blogIndexPath, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
}

function sortPosts(posts) {
  return posts.sort((a, b) => {
    const dateDiff = new Date(b.date || 0) - new Date(a.date || 0);
    if (dateDiff) return dateDiff;
    return String(a.title).localeCompare(String(b.title), 'zh-CN');
  });
}

async function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });
    let stdout = '';
    let stderr = '';

    if (options.capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(stdout.trim());
      } else {
        rejectPromise(new Error(`${command} ${args.join(' ')} 失败：${stderr.trim()}`));
      }
    });
  });
}

async function ensureCleanWorktree() {
  const status = await run('git', ['status', '--porcelain'], { capture: true });
  if (status) {
    throw new Error(`工作区不干净，避免误提交，先处理这些变更：\n${status}`);
  }
}

async function currentBranch() {
  return run('git', ['branch', '--show-current'], { capture: true });
}

async function main() {
  const { source, options } = parseArgs(process.argv.slice(2));

  if (options.help || !source) {
    usage();
    process.exit(options.help ? 0 : 1);
  }

  if ((options.commit || options.publish) && !options.dryRun) {
    await ensureCleanWorktree();
  }

  if (options.publish && !options.dryRun) {
    const branch = await currentBranch();
    await run('git', ['pull', '--rebase', 'origin', branch]);
  }

  const sourcePath = await resolveSource(source, options.vaultPath);
  const sourceStat = await stat(sourcePath);
  const rawMarkdown = await readFile(sourcePath, 'utf8');
  const parsed = parseFrontmatter(rawMarkdown.replace(/^\uFEFF/, ''));
  const title = options.title || parsed.data.title || titleFromFileName(sourcePath) || firstHeading(parsed.content);
  const date = options.date || parsed.data.date || dateOnly(sourceStat.mtime);
  const tag = options.tag || parsed.data.tag || inferTag(title);
  const category = options.category || parsed.data.category || '工程';
  const id = options.id || slugify(title || basename(sourcePath, '.md'));
  const file = `${id}.md`;
  const excerpt = options.excerpt || parsed.data.excerpt || parsed.data.description || inferExcerpt(parsed.content);
  const outputPath = join(blogDir, file);
  const posts = await readBlogIndex();

  let content = demoteHeadings(parsed.content, title);
  const embedResult = await convertObsidianEmbeds(content, sourcePath, id, options.dryRun);
  content = convertInternalLinks(embedResult.content, posts);

  const frontmatter = `---\ntitle: ${title}\ndate: ${date}\ntag: ${tag}\ncategory: ${category}\n---\n\n`;
  const output = `${frontmatter}${content.trim()}\n`;
  const entry = { id, file, title, date, tag, category, excerpt };
  const existingIndex = posts.findIndex((post) => post.id === id);
  const nextPosts = existingIndex === -1
    ? [entry, ...posts]
    : posts.map((post) => (post.id === id ? { ...post, ...entry } : post));
  sortPosts(nextPosts);

  if (options.dryRun) {
    console.log(JSON.stringify({
      sourcePath,
      outputPath,
      entry,
      copiedAssets: embedResult.copiedAssets,
      wouldUpdateExistingPost: existingIndex !== -1
    }, null, 2));
    return;
  }

  await writeFile(outputPath, output, 'utf8');
  await writeBlogIndex(nextPosts);
  await run('node', [sitemapScript]);

  console.log(`已导入：${relative(repoRoot, outputPath)}`);
  console.log(`访问：article.html?post=${id}`);

  if (options.commit) {
    const filesToStage = [
      relative(repoRoot, outputPath),
      'blog/index.json',
      'sitemap.xml',
      ...embedResult.copiedAssets.map((asset) => relative(repoRoot, asset))
    ];
    await run('git', ['add', ...filesToStage]);
    await run('git', ['commit', '-m', options.message || `content: 添加 ${title}`]);
  }

  if (options.publish) {
    await run('git', ['push', 'origin', await currentBranch()]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
