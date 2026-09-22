import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

async function browser() {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://blog.test/' });
  for (const path of ['assets/vendor/marked.js', 'assets/vendor/purify.min.js', 'assets/markdown.js']) {
    dom.window.eval(await readFile(path, 'utf8'));
  }
  return dom;
}

test('恶意 HTML 与脚本 URL 被去除，正常 Markdown 结构保留', async () => {
  const dom = await browser();
  const { window } = dom;
  try {
    const html = window.renderSafeMarkdown('# 标题\n\n**正文**\n\n<img src=x onerror="alert(1)"><script>alert(1)</script><svg onload="alert(1)"></svg>\n\n[恶意链接](javascript:alert%281%29)\n\n<a href="https://example.com">正常链接</a>\n\n<form action="https://evil.test"><input name="password"></form>');
    window.document.body.innerHTML = html;
    assert.equal(window.document.querySelector('h1').textContent, '标题');
    assert.equal(window.document.querySelector('strong').textContent, '正文');
    assert.equal(window.document.querySelector('script, svg, form, input, [onerror], [onload], a[href^="javascript:"]'), null);
    assert.ok(window.document.querySelector('a[href="https://example.com"]'));
  } finally { window.close(); }
});

test('净化器丢失时仅渲染文本，不输出活动 HTML', async () => {
  const dom = await browser();
  try {
    dom.window.DOMPurify = undefined;
    dom.window.document.body.innerHTML = dom.window.renderSafeMarkdown('<img src=x onerror="alert(1)">');
    assert.equal(dom.window.document.querySelector('img'), null);
    assert.match(dom.window.document.body.textContent, /<img/);
  } finally { dom.window.close(); }
});
