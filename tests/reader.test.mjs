import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const sample = {id:'test-note',file:'test-note.md',title:'测试文章',excerpt:'关于检索的笔记',date:'2026-09-22',category:'工程',tag:'AI',translations:{en:{file:'test-note.en.md',title:'A test note',excerpt:'Notes about retrieval'}}};
async function setup(page='blog',query='',options={}) {
  const dom = new JSDOM(await readFile(`${page === 'home' ? 'index' : page}.html`,'utf8'),{url:`https://blog.test/${page === 'home' ? 'index' : page}.html${query}`,runScripts:'outside-only'});
  const {window:w}=dom;
  let failures=options.failures || 0;
  w.fetch=async (url) => {
    if(failures-->0)throw new Error('离线');
    if(url==='blog/index.json')return {ok:true,json:async()=>options.posts ?? [sample]};
    return {ok:true,text:async()=> url.endsWith('.en.md') ? '# English text\n\n## Section\n\nEnglish body.' : '---\ntitle: 标题\n---\n\n## 开始\n\n中文正文。\n\n### 细节\n\n更多内容。'};
  };
  if(options.blockStorage) Object.defineProperty(w,'localStorage',{get(){throw new Error('存储已禁用');}});
  for(const script of ['assets/theme-init.js','i18n.js',...(page==='article' ? ['assets/vendor/marked.js','assets/vendor/purify.min.js','assets/markdown.js']:[]),'assets/site.js']) w.eval(await readFile(script,'utf8'));
  await settle();
  return dom;
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));

test('语言切换覆盖列表和标题，并保持查询、分类和文章链接',async()=>{
 const dom=await setup('blog','?q=检索&category=工程');const w=dom.window;
 try{
  assert.equal(w.document.querySelectorAll('.post-item').length,1);
  w.document.querySelector('[data-language-toggle]').click();await settle();
  assert.equal(w.document.documentElement.lang,'en');
  assert.equal(w.document.title,'Articles · Amorend');
  assert.equal(w.document.querySelector('[data-blog-count]').textContent,'1 article');
  assert.equal(w.document.querySelector('.post-item h2').textContent,'A test note');
  const url=new URL(w.document.querySelector('.post-item').href);
  assert.equal(url.searchParams.get('q'),'检索');assert.equal(url.searchParams.get('category'),'工程');assert.equal(url.searchParams.get('lang'),'en');
  assert.equal(w.localStorage.getItem('amorend.lang'),'en');
 }finally{w.close();}
});

test('搜索无结果时可以清除筛选，浏览器恢复 URL 后重新同步列表',async()=>{
 const dom=await setup();const w=dom.window;
 try{
  const input=w.document.querySelector('[data-search]');input.value='不存在';input.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.querySelectorAll('.post-item').length,0);
  w.document.querySelector('[data-reset]').click();assert.equal(w.document.querySelectorAll('.post-item').length,1);assert.equal(input.value,'');
  w.history.replaceState(null,'','?category=求职');w.dispatchEvent(new w.PopStateEvent('popstate'));await settle();
  assert.equal(w.document.querySelectorAll('.post-item').length,0);
 }finally{w.close();}
});

test('中英空列表都有明确提示，不生成虚构文章',async()=>{
 const dom=await setup('home','',{posts:[]});const w=dom.window;
 try{
  assert.match(w.document.querySelector('.empty-state').textContent,/暂时没有文章/);
  w.document.querySelector('[data-language-toggle]').click();await settle();
  assert.match(w.document.querySelector('.empty-state').textContent,/No articles/);
  assert.equal(w.document.querySelectorAll('.post-item').length,0);
 }finally{w.close();}
});

test('阅读页支持译文、目录和返回筛选；切换主题不改变文章标题',async()=>{
 const dom=await setup('article','?post=test-note&lang=en&q=AI&category=工程');const w=dom.window;
 try{
  assert.equal(w.document.querySelector('.article-header h1').textContent,'A test note');
  assert.match(w.document.querySelector('.article-body').textContent,/English body/);
  assert.equal(w.document.querySelector('.toc a').getAttribute('href'),'#section-1');
  const back=new URL(w.document.querySelector('.back-link').href);assert.equal(back.searchParams.get('q'),'AI');assert.equal(back.searchParams.get('category'),'工程');
  const title=w.document.title;w.document.querySelector('[data-theme-toggle]').click();assert.equal(w.document.title,title);
 }finally{w.close();}
});

test('没有译文时标注原文，缺失文章可返回列表',async()=>{
 const dom=await setup('article','?post=test-note&lang=en',{posts:[{...sample,translations:undefined}]});
 try{assert.match(dom.window.document.querySelector('.translation-note').textContent,/original in Chinese/);assert.equal(dom.window.document.querySelector('article').lang,'zh-CN');}finally{dom.window.close();}
 const missing=await setup('article','?post=unknown&lang=en');
 try{assert.match(missing.window.document.querySelector('[data-article-root]').textContent,/Article not found/);assert.ok(missing.window.document.querySelector('.back-link'));}finally{missing.window.close();}
});

test('无存储权限仍能切换语言和主题，加载失败可重试',async()=>{
 const dom=await setup('blog','',{blockStorage:true,failures:1});const w=dom.window;
 try{
  assert.ok(w.document.querySelector('[data-retry]'));w.document.querySelector('[data-retry]').click();await settle();assert.equal(w.document.querySelectorAll('.post-item').length,1);
  w.document.querySelector('[data-language-toggle]').click();await settle();assert.equal(w.document.documentElement.lang,'en');
  w.document.querySelector('[data-theme-toggle]').click();assert.equal(w.document.documentElement.dataset.theme,'dark');
 }finally{w.close();}
});


test('目录锚点的历史变化不重新创建正文',async()=>{
 const dom=await setup('article','?post=test-note');const w=dom.window;
 try{
  const body=w.document.querySelector('.article-body');
  w.history.pushState(null,'','#section-1');w.dispatchEvent(new w.PopStateEvent('popstate'));await settle();
  assert.equal(w.document.querySelector('.article-body'),body);
 }finally{w.close();}
});
