(function () {
  const messages = {
    zh: {
      skip:'跳到正文',journal:'个人博客',navigation:'主导航',home:'首页',articles:'文章',contact:'联系我 ↗',footer:'记录、理解，然后分享。',
      eyebrow:'学习 · 实践 · 记录',introTitle:'写下来，想清楚。',introDescription:'你好，我是 Amorend。在这里记录 AI、工程实践，以及值得慢慢想清楚的问题。',browse:'浏览全部文章',latest:'最近更新',aboutLabel:'关于这里',aboutTitle:'一个持续更新的笔记本。',aboutDescription:'整理学习中的疑问，记录实践中的发现。希望这些笔记，也能成为你的参考。',engineering:'工程实践',notes:'学习笔记',discuss:'欢迎交流 ↗',
      allArticles:'全部文章',archiveDescription:'按主题浏览，或搜索你感兴趣的内容。',breadcrumbs:'面包屑',articleList:'文章列表',categories:'文章分类',search:'搜索文章',searchPlaceholder:'搜索标题、摘要或标签',all:'全部',career:'求职',blog:'博客',engineeringCategory:'工程',count:'{n} 篇文章',loading:'正在加载文章…',emptyTitle:'新的篇章，正在准备。',emptyBody:'这里暂时没有文章。整理好新的想法后，会在这里与你分享。',noMatch:'没有找到匹配的文章',noMatchBody:'试试其他关键词，或清除筛选条件。',reset:'清除筛选',errorTitle:'暂时无法加载',errorBody:'请检查网络连接，然后重试。',retry:'重新加载',notFound:'文章不存在',notFoundBody:'这篇文章可能已移除，或链接有误。你可以返回列表浏览其他内容。',back:'返回文章列表',toc:'本文目录',previous:'上一篇',next:'下一篇',adjacent:'相邻文章',readingTime:'约 {n} 分钟阅读',original:'当前显示{language}原文，尚无中文译文。',languageZh:'中文',languageEn:'英文',dark:'切换到深色模式',light:'切换到浅色模式',homeTitle:'Amorend · 个人博客',blogTitle:'文章 · Amorend',articleTitle:'阅读 · Amorend',description:'Amorend 的个人博客，记录 AI、工程实践与学习笔记。'
    },
    en: {
      skip:'Skip to content',journal:'A personal blog',navigation:'Main navigation',home:'Home',articles:'Articles',contact:'Get in touch ↗',footer:'Write, understand, share.',
      eyebrow:'LEARN · BUILD · WRITE',introTitle:'Make room for clear thinking.',introDescription:'Hi, I’m Amorend. Notes on AI, engineering, and questions worth thinking through.',browse:'Explore all articles',latest:'Latest writing',aboutLabel:'ABOUT THIS SPACE',aboutTitle:'A notebook, always in progress.',aboutDescription:'Questions from learning. Discoveries from building. Notes that might be useful for your own work, too.',engineering:'Engineering',notes:'Learning notes',discuss:'Let’s talk ↗',
      allArticles:'All articles',archiveDescription:'Browse by topic, or search for something on your mind.',breadcrumbs:'Breadcrumbs',articleList:'Article list',categories:'Article categories',search:'Search articles',searchPlaceholder:'Search titles, summaries, or tags',all:'All',career:'Career',blog:'Notes',engineeringCategory:'Engineering',count:'{n} articles',loading:'Loading articles…',emptyTitle:'A new chapter is on its way.',emptyBody:'No articles here just yet. New thoughts and notes will find a home here soon.',noMatch:'No matching articles',noMatchBody:'Try another keyword, or clear your filters.',reset:'Clear filters',errorTitle:'Unable to load right now',errorBody:'Check your connection and try again.',retry:'Try again',notFound:'Article not found',notFoundBody:'This article may have been removed, or the link is incorrect. Browse the archive for other articles.',back:'Back to all articles',toc:'On this page',previous:'Previous article',next:'Next article',adjacent:'More articles',readingTime:'{n} min read',original:'Showing the original in {language}. An English translation is not available yet.',languageZh:'Chinese',languageEn:'English',dark:'Switch to dark mode',light:'Switch to light mode',homeTitle:'Amorend · A personal blog',blogTitle:'Articles · Amorend',articleTitle:'Reading · Amorend',description:'A personal blog by Amorend. Notes on AI, engineering, and learning.'
    }
  };
  let lang = document.documentElement.lang === 'en' ? 'en' : 'zh';
  const listeners = new Set();
  function t(key, vars = {}) {
    let text = lang === 'en' && key === 'count' && vars.n === 1 ? '1 article' : messages[lang][key] || messages.zh[key] || key;
    for (const [name,value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }
  function apply(scope = document) {
    scope.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    for (const attr of ['aria','placeholder']) {
      scope.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => el.setAttribute(attr === 'aria' ? 'aria-label' : attr, t(el.dataset[attr === 'aria' ? 'i18nAria' : 'i18nPlaceholder'])));
    }
    document.querySelector('meta[name="description"]')?.setAttribute('content',t('description'));
  }
  function setLang(next) {
    if (!['zh','en'].includes(next) || next === lang) return;
    lang = next;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    try { localStorage.setItem('amorend.lang', lang); } catch { /* 无存储权限时仍可切换。 */ }
    const url = new URL(location.href); url.searchParams.set('lang',lang);
    history.replaceState(history.state,'',url);
    apply(); listeners.forEach((listener) => listener());
  }
  window.__I18N__ = {t,apply,setLang,onChange: (fn) => listeners.add(fn),get lang(){return lang;}};
  apply();
})();
