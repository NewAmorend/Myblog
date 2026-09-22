(function () {
  const i18n = window.__I18N__;
  const t = i18n.t;
  const page = document.body.dataset.page;
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const categories = [['all','all'],['求职','career'],['博客','blog'],['工程','engineeringCategory']];
  let posts = null;
  let series = [];
  let loadingPosts = null;
  let renderVersion = 0;
  let renderedSearch = location.search;
  const textCache = new Map();
  const wideScreen = window.matchMedia?.('(min-width: 801px)');
  wideScreen?.addEventListener('change',(event) => {
    const menu = qs('.series-navigation');
    if (menu) menu.open = event.matches;
  });

  function route(path, params = {}) {
    const url = new URL(path,location.href);
    url.searchParams.set('lang',i18n.lang);
    for (const [key,value] of Object.entries(params)) if (value) url.searchParams.set(key,value);
    return url.pathname + url.search + url.hash;
  }
  function archiveRoute() {
    const current = new URLSearchParams(location.search);
    return route('blog.html',{q:current.get('q'),category:current.get('category')});
  }
  function articleRoute(post) {
    const current = new URLSearchParams(location.search);
    return route('article.html',{post:post.id,...(findSeries(post.id) ? {} : {q:current.get('q'),category:current.get('category')})});
  }
  function syncShell() {
    i18n.apply();
    all('[data-route]').forEach((link) => { link.href = route(link.getAttribute('href')); });
    all('[data-nav]').forEach((link) => {
      if (link.dataset.nav === (page === 'article' ? (findSeries(new URLSearchParams(location.search).get('post')) ? 'series' : 'blog') : page)) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    const toggle = qs('[data-language-toggle]');
    toggle.textContent = i18n.lang === 'zh' ? 'EN' : '中文';
    toggle.lang = i18n.lang === 'zh' ? 'en' : 'zh-CN';
    toggle.setAttribute('aria-label',i18n.lang === 'zh' ? 'Switch to English' : '切换到中文');
    const label = t(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    qs('[data-theme-toggle]').setAttribute('aria-label',label);
    qs('[data-theme-label]').textContent = t(document.documentElement.dataset.theme === 'dark' ? 'lightLabel' : 'darkLabel');
    if (page !== 'article' && !(page === 'series' && new URLSearchParams(location.search).has('series'))) document.title = t(`${page}Title`);
  }
  async function loadPosts() {
    if (posts !== null) return posts;
    if (!loadingPosts) loadingPosts = Promise.all(['blog/index.json','series/index.json'].map(async (path) => {
      const response = await fetch(path,{cache:'no-cache'});
      if (!response.ok) throw new Error('内容索引请求失败');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('内容索引格式错误');
      return data;
    })).then(([articles,collections]) => {
      // 一篇文章只属于一个系列，目录是章节顺序的唯一来源。
      const claimed = new Set();
      const ids = new Set();
      for (const collection of collections) {
        if (!collection.id || ids.has(collection.id) || !Array.isArray(collection.chapters)) throw new Error('系列目录格式错误');
        ids.add(collection.id);
        for (const id of collection.chapters) {
          if (typeof id !== 'string' || claimed.has(id)) throw new Error('章节重复归属');
          claimed.add(id);
        }
      }
      series = collections;
      posts = articles.sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
      return posts;
    }).catch((error) => { loadingPosts = null; throw error; });
    return loadingPosts;
  }
  function findSeries(id) { return series.find((item) => item.chapters.includes(id)); }
  function seriesRoute(item) { return route('series.html',{series:item.id}); }
  function seriesText(item) {
    const translation = item.translations?.[i18n.lang];
    return {...item,...translation,id:item.id,chapters:item.chapters};
  }
  function chaptersOf(item) {
    return item.chapters.map((id) => posts.find((post) => post.id === id)).filter(Boolean);
  }
  function chapterList(item,currentId) {
    return `<ol class="chapter-list">${chaptersOf(item).map((post,index) => `<li><a href="${escape(articleRoute(post))}"${post.id === currentId ? ' aria-current="page"' : ''}><span class="chapter-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span>${escape(localized(post).title)}</span></a>${post.id === currentId ? `<details class="toc" hidden><summary>${t('toc')}</summary><ol></ol></details>` : ''}</li>`).join('')}</ol>`;
  }
  function renderSeries() {
    const root = qs('[data-series-root]');
    const id = new URLSearchParams(location.search).get('series');
    if (!id) {
      root.innerHTML = `<header class="page-heading"><h1>${t('series')}</h1><p>${t('seriesDescription')}</p></header>${series.length ? `<div class="series-list">${series.map((item) => {
        const text = seriesText(item);
        return `<a class="series-item" href="${escape(seriesRoute(item))}"><h2>${escape(text.title)}</h2><p>${escape(text.description || '')}</p><span class="count">${t('chapterCount',{n:chaptersOf(item).length})}</span></a>`;
      }).join('')}</div>` : `<div class="empty-state"><h2>${t('seriesEmpty')}</h2><p>${t('seriesEmptyBody')}</p></div>`}`;
      return;
    }
    const item = series.find((entry) => entry.id === id);
    if (!item) {
      document.title = `${t('seriesMissing')} · Amorend`;
      root.innerHTML = `<h1>${t('seriesMissing')}</h1><a class="back-link" href="${route('series.html')}">${t('backSeries')}</a>`;
      return;
    }
    const text = seriesText(item);
    const chapters = chaptersOf(item);
    document.title = `${text.title} · Amorend`;
    root.innerHTML = `<nav class="breadcrumbs" aria-label="${t('breadcrumbs')}"><a href="${route('series.html')}">${t('series')}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(text.title)}</span></nav><header class="page-heading"><h1>${escape(text.title)}</h1><p>${escape(text.description || '')}</p></header>${text.prerequisites ? `<section class="prerequisites"><h2>${t('prerequisites')}</h2><p>${escape(text.prerequisites)}</p></section>` : ''}<section class="series-outline"><h2>${t('chapters')}</h2>${chapters.length ? chapterList(item) : `<p class="status">${t('seriesEmptyBody')}</p>`}</section>${chapters.length ? `<a class="start-reading" href="${escape(articleRoute(chapters[0]))}">${t('startReading')} →</a>` : ''}`;
  }
  function localized(post) {
    const originalLang = post.language === 'en' ? 'en' : 'zh';
    const translation = post.translations?.[i18n.lang];
    return translation?.file ? {...post,...translation,id:post.id,language:i18n.lang,fallback:false} : {...post,language:originalLang,fallback:originalLang !== i18n.lang};
  }
  function dateLabel(date) {
    const parsed = new Date(`${date}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? String(date || '') : new Intl.DateTimeFormat(i18n.lang === 'zh' ? 'zh-CN' : 'en',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(parsed);
  }
  function card(post) {
    const item = localized(post);
    return `<a class="post-item" href="${escape(articleRoute(post))}"><div class="post-meta"><time datetime="${escape(post.date)}">${escape(dateLabel(post.date))}</time>${post.tag ? `<span class="tag">${escape(post.tag)}</span>` : ''}${item.fallback ? `<span class="post-language">${escape(t(item.language === 'en' ? 'languageEn' : 'languageZh'))}</span>` : ''}</div><h2 lang="${item.language === 'en' ? 'en' : 'zh-CN'}">${escape(item.title)}</h2>${item.excerpt ? `<p lang="${item.language === 'en' ? 'en' : 'zh-CN'}">${escape(item.excerpt)}</p>` : ''}</a>`;
  }
  function empty(filtered = false) {
    return `<div class="empty-state"><h2>${escape(t(filtered ? 'noMatch' : 'emptyTitle'))}</h2><p>${escape(t(filtered ? 'noMatchBody' : 'emptyBody'))}</p>${filtered ? `<button type="button" data-reset>${escape(t('reset'))}</button>` : ''}</div>`;
  }
  function filterState() {
    const params = new URLSearchParams(location.search);
    const category = categories.some(([id]) => id === params.get('category')) ? params.get('category') : 'all';
    return {q:params.get('q') || '',category};
  }
  function updateFilters(query,category) {
    const url = new URL(location.href);
    query ? url.searchParams.set('q',query) : url.searchParams.delete('q');
    category !== 'all' ? url.searchParams.set('category',category) : url.searchParams.delete('category');
    history.replaceState(history.state,'',url);
    if (posts) renderArchive(posts);
  }
  function renderArchive(items) {
    items = items.filter((post) => !findSeries(post.id));
    const state = filterState();
    const search = qs('[data-search]');
    if (search.value !== state.q) search.value = state.q;
    const query = state.q.trim().toLocaleLowerCase();
    const filtered = items.filter((post) => {
      const item = localized(post);
      return (state.category === 'all' || (post.category || '工程') === state.category) &&
        [item.title,item.excerpt,post.title,post.excerpt,post.tag].some((value) => String(value || '').toLocaleLowerCase().includes(query));
    });
    qs('[data-blog-count]').textContent = t('count',{n:filtered.length});
    qs('[data-category-bar]').innerHTML = categories.map(([id,label]) => `<button class="cat-btn" type="button" data-category="${id}" aria-pressed="${state.category === id}">${escape(t(label))}<span class="cat-count">${items.filter((post) => id === 'all' || (post.category || '工程') === id).length}</span></button>`).join('');
    qs('[data-blog-list]').innerHTML = filtered.length ? filtered.map(card).join('') : empty(Boolean(query || state.category !== 'all'));
  }
  async function markdown(file) {
    // 译文也只能读取博客目录中的 Markdown，不能借索引跳出内容目录。
    if (typeof file !== 'string' || !/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.md$/.test(file)) throw new Error('文章路径不合法');
    if (!textCache.has(file)) {
      const response = await fetch(`blog/${file}`,{cache:'no-cache'});
      if (!response.ok) throw new Error('文章请求失败');
      textCache.set(file,await response.text());
    }
    return textCache.get(file).replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
  }
  async function renderArticle(items,version) {
    const root = qs('[data-article-root]');
    const index = items.findIndex((post) => post.id === new URLSearchParams(location.search).get('post'));
    let breadcrumbs = `<nav class="breadcrumbs" aria-label="${escape(t('breadcrumbs'))}"><a href="${route('index.html')}">${t('home')}</a><span aria-hidden="true">/</span><a href="${escape(archiveRoute())}">${t('articles')}</a><span aria-hidden="true">/</span><span aria-current="page">${t('articleTitle').split(' · ')[0]}</span></nav>`;
    if (index === -1) {
      document.title = `${t('notFound')} · Amorend`;
      root.innerHTML = `${breadcrumbs}<div class="empty-state"><h1>${t('notFound')}</h1><p>${t('notFoundBody')}</p><a class="back-link" href="${escape(archiveRoute())}">← ${t('back')}</a></div>`;
      return;
    }
    const original = items[index];
    const collection = findSeries(original.id);
    const chapterItems = collection ? chaptersOf(collection) : [];
    const chapterIndex = chapterItems.findIndex((item) => item.id === original.id);
    const collectionText = collection ? seriesText(collection) : null;
    const post = localized(original);
    if (collection) breadcrumbs = `<nav class="breadcrumbs" aria-label="${t('breadcrumbs')}"><a href="${route('series.html')}">${t('series')}</a><span aria-hidden="true">/</span><a href="${escape(seriesRoute(collection))}">${escape(collectionText.title)}</a><span aria-hidden="true">/</span><span aria-current="page">${t('chapterPosition',{n:chapterIndex+1,total:chapterItems.length})}</span></nav>`;
    const content = await markdown(post.file);
    if (version !== renderVersion) return;
    const html = window.renderSafeMarkdown ? window.renderSafeMarkdown(content) : `<pre>${escape(content)}</pre>`;
    const minutes = Math.max(1,Math.ceil(((content.match(/[\u3400-\u9fff]/g)||[]).length / 400) + ((content.match(/[A-Za-z0-9]+/g)||[]).length / 220)));
    const adjacent = (item,label) => item ? `<a class="next-card" href="${escape(articleRoute(item))}"><span>${escape(t(label))}</span><strong>${escape(localized(item).title)}</strong></a>` : '<span></span>';
    window.MathJax?.typesetClear?.([root]);
    root.innerHTML = `${breadcrumbs}<div class="reading-layout${collection ? ' has-series' : ' standalone'}">${collection ? `<aside class="series-sidebar"><details class="series-navigation"><summary>${t('seriesContents')}</summary><a class="series-name" href="${escape(seriesRoute(collection))}">${escape(collectionText.title)}</a>${chapterList(collection,post.id)}</details></aside>` : ''}<article lang="${post.language === 'en' ? 'en' : 'zh-CN'}"><header class="article-header"><div class="article-meta"><time datetime="${escape(post.date)}">${escape(dateLabel(post.date))}</time><span>${escape(t('readingTime',{n:minutes}))}</span>${post.tag ? `<span class="tag">${escape(post.tag)}</span>` : ''}</div><h1>${escape(post.title)}</h1>${post.excerpt ? `<p class="article-excerpt">${escape(post.excerpt)}</p>` : ''}</header>${post.fallback ? `<p class="translation-note">${escape(t('original',{language:t(post.language === 'en' ? 'languageEn' : 'languageZh')}))}</p>` : ''}<details class="toc inline-toc" hidden><summary>${t('toc')}</summary><ol></ol></details><div class="article-body">${html}</div>${collection ? `<nav class="article-nav" aria-label="${t('chapters')}">${adjacent(chapterItems[chapterIndex-1],'previousChapter')}${adjacent(chapterItems[chapterIndex+1],'nextChapter')}</nav>` : ''}<a class="back-link" href="${escape(collection ? seriesRoute(collection) : archiveRoute())}">← ${t(collection ? 'seriesContents' : 'back')}</a></article></div>`;
    document.title = `${post.title} · Amorend`;
    const headings = all('.article-body h2,.article-body h3',root);
    if (headings.length) {
      const entries = headings.map((heading,i) => {
        heading.id = `section-${i+1}`;
        return `<li class="${heading.tagName === 'H3' ? 'toc-sub' : ''}"><a href="#${heading.id}">${escape(heading.textContent)}</a></li>`;
      }).join('');
      const toc = qs(collection ? '.series-sidebar .toc' : '.inline-toc',root);
      toc.hidden = false;
      qs('ol',toc).innerHTML = entries;
    }
    const seriesNavigation = qs('.series-navigation',root);
    if (seriesNavigation) seriesNavigation.open = wideScreen?.matches ?? true;
    const typeset = async () => {
      await window.MathJax?.startup?.promise;
      if (version === renderVersion && window.MathJax?.typesetPromise) await window.MathJax.typesetPromise([qs('.article-body',root)]);
      if (version === renderVersion && location.hash.startsWith('#section-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    };
    typeset().catch(() => {});
    if (!window.MathJax?.typesetPromise) window.addEventListener('load',() => typeset().catch(() => {}),{once:true});
  }
  async function render() {
    const version = ++renderVersion;
    renderedSearch = location.search;
    syncShell();
    if (page === 'home') return;
    try {
      const items = await loadPosts();
      if (version !== renderVersion) return;
      syncShell();
      if (page === 'series') renderSeries();
      else if (page === 'blog') renderArchive(items);
      else if (page === 'article') await renderArticle(items,version);
    } catch {
      if (version !== renderVersion) return;
      const target = qs('[data-series-root],[data-blog-list],[data-article-root]');
      target.innerHTML = `<div class="empty-state" role="alert"><h2>${t('errorTitle')}</h2><p>${t('errorBody')}</p><button type="button" data-retry>${t('retry')}</button></div>`;
    }
  }
  qs('[data-language-toggle]').addEventListener('click',() => i18n.setLang(i18n.lang === 'zh' ? 'en' : 'zh'));
  qs('[data-theme-toggle]').addEventListener('click',() => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('amorend-reading-theme',theme); } catch { /* 禁用存储不影响阅读。 */ }
    syncShell();
  });
  qs('[data-search]')?.addEventListener('input',(event) => updateFilters(event.target.value,filterState().category));
  document.addEventListener('click',(event) => {
    const category = event.target.closest('[data-category]');
    if (category) {
      updateFilters(filterState().q,category.dataset.category);
      all('[data-category]').find((button) => button.dataset.category === category.dataset.category)?.focus();
    }
    if (event.target.closest('[data-reset]')) { updateFilters('','all');qs('[data-search]')?.focus(); }
    if (event.target.closest('[data-retry]')) render();
  });
  // 目录锚点由浏览器处理，避免重新排版正文和公式。
  window.addEventListener('popstate',() => { if (location.search !== renderedSearch) render(); });
  window.addEventListener('pageshow',(event) => { if (event.persisted) render(); });
  i18n.onChange(render);
  render();
})();
