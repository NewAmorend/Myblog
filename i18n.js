(function () {
  const messages = {
    zh: {
      series:'系列',seriesTitle:'系列 · Amorend',bio:'关注 AI 与工程实践。在这里写系列文章，也记录独立的思考与笔记。',entrances:'阅读入口',email:'邮箱',seriesDescription:'围绕一个主题，按章节展开。',seriesEmpty:'暂无系列',seriesEmptyBody:'系列发布后，会在这里列出。',seriesMissing:'系列不存在',backSeries:'返回系列',chapters:'章节目录',prerequisites:'阅读前提',startReading:'开始阅读',previousChapter:'上一章',nextChapter:'下一章',chapterPosition:'第 {n} 章 / 共 {total} 章',chapterCount:'{n} 章',seriesContents:'系列目录',lightLabel:'浅色',darkLabel:'深色',skip:'跳到正文',journal:'个人博客',navigation:'主导航',home:'首页',articles:'文章',contact:'联系我 ↗',footer:'记录、理解，然后分享。',
      allArticles:'全部文章',archiveDescription:'系列之外的独立文章，按发布时间排列。',breadcrumbs:'面包屑',articleList:'文章列表',categories:'文章分类',search:'搜索文章',searchPlaceholder:'搜索标题、摘要或标签',all:'全部',career:'求职',blog:'博客',engineeringCategory:'工程',count:'{n} 篇文章',loading:'正在加载文章…',emptyTitle:'暂无文章',emptyBody:'独立文章发布后，会在这里列出。',noMatch:'没有找到匹配的文章',noMatchBody:'试试其他关键词，或清除筛选条件。',reset:'清除筛选',errorTitle:'暂时无法加载',errorBody:'请检查网络连接，然后重试。',retry:'重新加载',notFound:'文章不存在',notFoundBody:'这篇文章可能已移除，或链接有误。你可以返回列表浏览其他内容。',back:'返回文章列表',toc:'本文目录',previous:'上一篇',next:'下一篇',adjacent:'相邻文章',readingTime:'约 {n} 分钟阅读',original:'当前显示{language}原文，尚无中文译文。',languageZh:'中文',languageEn:'英文',dark:'切换到深色模式',light:'切换到浅色模式',homeTitle:'Amorend',blogTitle:'文章 · Amorend',articleTitle:'阅读 · Amorend',description:'Amorend 的个人博客，记录 AI、工程实践与学习笔记。'
    },
    en: {
      series:'Series',seriesTitle:'Series · Amorend',bio:'Interested in AI and engineering. I write in-depth series, alongside standalone essays and notes.',entrances:'Reading entrances',email:'Email',seriesDescription:'Explore a subject, one chapter at a time.',seriesEmpty:'No series yet',seriesEmptyBody:'Published series will appear here.',seriesMissing:'Series not found',backSeries:'Back to series',chapters:'Chapters',prerequisites:'Before you begin',startReading:'Start reading',previousChapter:'Previous chapter',nextChapter:'Next chapter',chapterPosition:'Chapter {n} of {total}',chapterCount:'{n} chapters',seriesContents:'Series contents',lightLabel:'Light',darkLabel:'Dark',skip:'Skip to content',journal:'A personal blog',navigation:'Main navigation',home:'Home',articles:'Articles',contact:'Get in touch ↗',footer:'Write, understand, share.',
      allArticles:'All articles',archiveDescription:'Standalone essays and notes, in chronological order.',breadcrumbs:'Breadcrumbs',articleList:'Article list',categories:'Article categories',search:'Search articles',searchPlaceholder:'Search titles, summaries, or tags',all:'All',career:'Career',blog:'Notes',engineeringCategory:'Engineering',count:'{n} articles',loading:'Loading articles…',emptyTitle:'No articles yet',emptyBody:'Standalone articles will appear here once published.',noMatch:'No matching articles',noMatchBody:'Try another keyword, or clear your filters.',reset:'Clear filters',errorTitle:'Unable to load right now',errorBody:'Check your connection and try again.',retry:'Try again',notFound:'Article not found',notFoundBody:'This article may have been removed, or the link is incorrect. Browse the archive for other articles.',back:'Back to all articles',toc:'On this page',previous:'Previous article',next:'Next article',adjacent:'More articles',readingTime:'{n} min read',original:'Showing the original in {language}. An English translation is not available yet.',languageZh:'Chinese',languageEn:'English',dark:'Switch to dark mode',light:'Switch to light mode',homeTitle:'Amorend',blogTitle:'Articles · Amorend',articleTitle:'Reading · Amorend',description:'A personal blog by Amorend. Notes on AI, engineering, and learning.'
    }
  };
  let lang = document.documentElement.lang === 'en' ? 'en' : 'zh';
  const listeners = new Set();
  function t(key, vars = {}) {
    let text = lang === 'en' && key === 'count' && vars.n === 1 ? '1 article' : messages[lang][key] || messages.zh[key] || key;
    if (lang === 'en' && key === 'chapterCount' && vars.n === 1) text = '1 chapter';
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
