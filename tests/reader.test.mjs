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
    if(url==='series/index.json')return {ok:true,json:async()=>options.series ?? []};
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
 const dom=await setup('blog','',{posts:[]});const w=dom.window;
 try{
  assert.match(w.document.querySelector('.empty-state').textContent,/暂无文章/);
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


const chapterTwo = {...sample,id:'second',file:'second.md',title:'第二章',date:'2026-09-01',translations:undefined};
const solo = {...sample,id:'solo',file:'solo.md',title:'独立文章',translations:undefined};
const collection = {id:'systems',title:'系统学习',description:'系统的基础与实践',prerequisites:'基础编程知识',chapters:['test-note','second'],translations:{en:{title:'Systems',description:'Foundations and practice'}}};

test('首页只有简介与入口，不请求内容索引或显示顶部导航',async()=>{
 const dom=await setup('home','',{failures:10});const w=dom.window;
 try{
  assert.equal(w.document.querySelector('.site-header'),null);
  assert.equal(w.document.querySelector('[data-home-posts]'),null);
  assert.match(w.document.querySelector('.bio').textContent,/AI/);
  assert.equal(w.document.querySelectorAll('.home-entries a').length,2);
  w.document.querySelector('[data-language-toggle]').click();await settle();
  assert.equal(w.document.querySelector('.home-entries a').textContent,'Series');
  assert.match(w.document.querySelector('.home-entries a').href,/lang=en/);
 }finally{w.close();}
});

test('独立文章列表排除系列章节，搜索和数量只针对独立文章',async()=>{
 const dom=await setup('blog','',{posts:[sample,chapterTwo,solo],series:[collection]});const w=dom.window;
 try{
  assert.deepEqual([...w.document.querySelectorAll('.post-item h2')].map(el=>el.textContent),['独立文章']);
  assert.equal(w.document.querySelector('[data-blog-count]').textContent,'1 篇文章');
 }finally{w.close();}
});

test('系列入口展示目录且手动顺序不受日期影响，切换语言保留系列',async()=>{
 const reordered={...collection,chapters:['second','test-note']};
 const dom=await setup('series','?series=systems',{posts:[sample,chapterTwo,solo],series:[reordered]});const w=dom.window;
 try{
  const links=[...w.document.querySelectorAll('.chapter-list a')];
  assert.deepEqual(links.map(el=>new URL(el.href).searchParams.get('post')),['second','test-note']);
  assert.match(w.document.querySelector('.start-reading').href,/post=second/);
  w.document.querySelector('[data-language-toggle]').click();await settle();
  assert.equal(w.document.querySelector('h1').textContent,'Systems');
  assert.equal(new URL(w.location.href).searchParams.get('series'),'systems');
  const title=w.document.title;w.document.querySelector('[data-theme-toggle]').click();assert.equal(w.document.title,title);
 }finally{w.close();}
});

test('章节导航只在同系列内移动，直接访问也能识别所属系列',async()=>{
 const dom=await setup('article','?post=test-note',{posts:[solo,chapterTwo,sample],series:[collection]});const w=dom.window;
 try{
  assert.ok(w.document.querySelector('.series-sidebar'));
  assert.equal(w.document.querySelector('[data-nav="series"]').getAttribute('aria-current'),'page');
  assert.match(w.document.querySelector('.chapter-list [aria-current="page"]').href,/post=test-note/);
  const adjacent=[...w.document.querySelectorAll('.next-card')];
  assert.equal(adjacent.length,1);assert.match(adjacent[0].textContent,/下一章/);assert.match(adjacent[0].href,/post=second/);
  w.document.querySelector('[data-language-toggle]').click();await settle();
  assert.equal(new URL(w.location.href).searchParams.get('post'),'test-note');
  assert.equal(w.document.querySelector('.article-header h1').textContent,'A test note');
  assert.match(w.document.querySelector('.back-link').href,/series=systems/);
 }finally{w.close();}
 const last=await setup('article','?post=second',{posts:[solo,chapterTwo,sample],series:[collection]});
 try{assert.match(last.window.document.querySelector('.next-card').textContent,/上一章/);assert.equal(last.window.document.querySelectorAll('.next-card').length,1);}finally{last.window.close();}
});

test('独立文章没有系列侧栏或强加的相邻文章',async()=>{
 const dom=await setup('article','?post=solo',{posts:[sample,solo],series:[collection]});
 try{
  assert.equal(dom.window.document.querySelector('.series-sidebar'),null);
  assert.equal(dom.window.document.querySelector('.article-nav'),null);
  assert.ok(dom.window.document.querySelector('.inline-toc:not([hidden])'));
 }finally{dom.window.close();}
});

test('空系列、无效链接和未发布章节均不会生成死链接',async()=>{
 for(const [query,series] of [['',[]],['?series=missing',[]],['?series=systems',[{...collection,chapters:['unpublished']}]]]){
  const dom=await setup('series',query,{series,posts:[]});
  try{assert.equal(dom.window.document.querySelectorAll('.chapter-list a').length,0);assert.equal(dom.window.document.querySelector('.start-reading'),null);assert.ok(dom.window.document.querySelector('[data-series-root]').textContent.trim());}finally{dom.window.close();}
 }
});

test('系列标题等元数据按纯文本显示，重复章节归属明确报错',async()=>{
 const dom=await setup('series','',{series:[{...collection,title:'<img src=x onerror=alert(1)>'}]});
 try{assert.equal(dom.window.document.querySelector('.series-list img'),null);assert.match(dom.window.document.querySelector('.series-item h2').textContent,/<img/);}finally{dom.window.close();}
 const invalid=await setup('series','',{series:[collection,{...collection,id:'other'}]});
 try{assert.ok(invalid.window.document.querySelector('[data-retry]'));}finally{invalid.window.close();}
});
