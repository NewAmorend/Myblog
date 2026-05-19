// 多语言：URL ?lang=en > localStorage > navigator.language > 默认 zh
(function () {
  const STORAGE_KEY = 'amorend.lang';
  const SUPPORTED = ['zh', 'en'];

  const dict = {
    zh: {
      'nav.home': '首页',
      'nav.works': '作品',
      'nav.blog': '博客',
      'nav.contact': '联系',
      'nav.channel.research': '研究',
      'nav.channel.photo': '摄影',
      'nav.channel.music': '音乐',
      'nav.channel.social': '社交',
      'nav.channel.archive': '灵感',
      'lang.toggle.title.toEN': 'Switch to English',
      'lang.toggle.title.toZH': '切换到中文',
      'theme.toggle.toDark': '切换到深色模式',
      'theme.toggle.toLight': '切换到亮色模式',
      'music.toggle.title': '播放/暂停音乐',

      // blog hero
      'blog.title': 'Blog',
      'blog.eyebrow': 'v_2026 / Research Notes / Built by Amorend',
      'blog.lead': '把 AI、工程实践、研究笔记 调成一根可被滚动拨动的弦。',
      'blog.note': '每个版块是一段信号：文章、影像、音乐、社交和灵感，会在这里汇合。',
      'blog.microCopy': 'Concentrate / Keep Scrolling / Let the notes unfold',
      'blog.scrollCue': 'Scroll',
      'blog.loading': '内容频道加载中...',
      'blog.footer.copy': 'Amorend © 2026',

      // channels
      'channel.research.kicker': 'Channel / Research',
      'channel.research.title': '研究手记',
      'channel.research.date': 'AI / CV / LLM',
      'channel.research.excerpt': '记录我在 AI Agent、计算机视觉、大语言模型和医学影像方向里的问题意识、实验路径和阶段性判断。',

      'channel.photo.kicker': 'Channel / Photography',
      'channel.photo.title': '摄影集',
      'channel.photo.date': 'Frames / Daily Life',
      'channel.photo.excerpt': '放一些生活里的构图、光线和瞬间。它不一定服务于技术，但会保存我观察世界的方式。',
      'channel.photo.action': 'Coming Soon',

      'channel.music.kicker': 'Channel / Music',
      'channel.music.title': '正在听',
      'channel.music.date': 'Loop / 在雨后醒来',
      'channel.music.excerpt': '音乐是我切换状态的开关。这里会放最近循环、写代码时的歌单，以及一些和情绪有关的片段。',
      'channel.music.action': 'Play Music',

      'channel.social.kicker': 'Channel / Social',
      'channel.social.title': '社交媒体',
      'channel.social.date': 'Connect / Share',
      'channel.social.excerpt': '以后这里会汇总我在不同平台的输出：研究动态、项目进展、自媒体观察，以及一些短想法。',
      'channel.social.action': 'Contact Me',

      'channel.archive.kicker': 'Channel / Archive',
      'channel.archive.title': '灵感档案',
      'channel.archive.date': 'Notes / References',
      'channel.archive.excerpt': '把暂时还没有长成文章的想法放在这里：一句话、一个问题、一张图、一次对话，先存档再发酵。',
      'channel.archive.action': 'Read Notes',

      // filters
      'filters.search.placeholder': '搜索标题、tag、摘要…',
      'filters.search.aria': '搜索文章',
      'filters.tags.aria': '按 tag 筛选',
      'filters.count': '{n} / {m} 篇',
      'filters.empty.loading': '文章加载中...',
      'filters.empty.none': '暂无文章。',
      'filters.empty.noMatch': '没有匹配的文章。',
      'filters.empty.error': '文章列表加载失败。',

      // article
      'article.title.default': '文章 - Amorend',
      'article.notFound.title': '文章不存在 - Amorend',
      'article.notFound.h1': '文章不存在',
      'article.notFound.body': '这个文章 ID 没有出现在博客索引里，回到博客列表重新选择一篇吧。',
      'article.backToBlog': '返回博客',
      'article.readingLabel': 'Reading',
      'article.prev': 'Previous Signal',
      'article.next': 'Next Signal',
      'article.loadFail.title': '加载失败',
      'article.loadFail.body': '内容加载失败，请刷新页面重试。',
      'article.translationMissing': '本文暂无 English 版本，下面显示中文原文。',

      // work
      'work.title': 'ALL WORKS',
      'work.subtitle': '探索我的项目世界',
      'work.loading': '作品加载中...',
      'work.empty': '暂无作品',
      'work.modal.loading.title': '加载中...',
      'work.modal.loading.body': '内容加载中...',
      'work.modal.fail.title': '加载失败',
      'work.modal.fail.body': '内容加载失败，请刷新页面重试。',
    },

    en: {
      'nav.home': 'Home',
      'nav.works': 'Works',
      'nav.blog': 'Blog',
      'nav.contact': 'Contact',
      'nav.channel.research': 'Research',
      'nav.channel.photo': 'Frames',
      'nav.channel.music': 'Music',
      'nav.channel.social': 'Social',
      'nav.channel.archive': 'Archive',
      'lang.toggle.title.toEN': 'Switch to English',
      'lang.toggle.title.toZH': '切换到中文',
      'theme.toggle.toDark': 'Switch to dark mode',
      'theme.toggle.toLight': 'Switch to light mode',
      'music.toggle.title': 'Play / Pause music',

      // blog hero
      'blog.title': 'Blog',
      'blog.eyebrow': 'v_2026 / Research Notes / Built by Amorend',
      'blog.lead': 'Tuning AI, engineering practice, and research notes into a string you can pluck by scrolling.',
      'blog.note': 'Each section is a signal — articles, frames, music, social, and inspiration converge here.',
      'blog.microCopy': 'Concentrate / Keep Scrolling / Let the notes unfold',
      'blog.scrollCue': 'Scroll',
      'blog.loading': 'Loading channels...',
      'blog.footer.copy': 'Amorend © 2026',

      // channels
      'channel.research.kicker': 'Channel / Research',
      'channel.research.title': 'Research Notes',
      'channel.research.date': 'AI / CV / LLM',
      'channel.research.excerpt': 'My questions, experiments, and provisional conclusions across AI Agents, computer vision, large language models, and medical imaging.',

      'channel.photo.kicker': 'Channel / Photography',
      'channel.photo.title': 'Frames',
      'channel.photo.date': 'Frames / Daily Life',
      'channel.photo.excerpt': 'Composition, light, and moments from daily life. Not always technical — just the way I see the world.',
      'channel.photo.action': 'Coming Soon',

      'channel.music.kicker': 'Channel / Music',
      'channel.music.title': 'Now Playing',
      'channel.music.date': 'Loop / 在雨后醒来',
      'channel.music.excerpt': 'Music is how I switch states. Recent loops, coding playlists, and emotional fragments live here.',
      'channel.music.action': 'Play Music',

      'channel.social.kicker': 'Channel / Social',
      'channel.social.title': 'Social',
      'channel.social.date': 'Connect / Share',
      'channel.social.excerpt': 'Eventually a digest of what I post elsewhere: research updates, project notes, media observations, and quick thoughts.',
      'channel.social.action': 'Contact Me',

      'channel.archive.kicker': 'Channel / Archive',
      'channel.archive.title': 'Inspiration Archive',
      'channel.archive.date': 'Notes / References',
      'channel.archive.excerpt': 'Ideas that haven\'t grown into articles yet — a sentence, a question, an image, a conversation. Archived first, fermented later.',
      'channel.archive.action': 'Read Notes',

      // filters
      'filters.search.placeholder': 'Search title, tag, excerpt…',
      'filters.search.aria': 'Search articles',
      'filters.tags.aria': 'Filter by tag',
      'filters.count': '{n} of {m} posts',
      'filters.empty.loading': 'Loading articles...',
      'filters.empty.none': 'No articles yet.',
      'filters.empty.noMatch': 'No matching articles.',
      'filters.empty.error': 'Failed to load articles.',

      // article
      'article.title.default': 'Article - Amorend',
      'article.notFound.title': 'Article not found - Amorend',
      'article.notFound.h1': 'Article not found',
      'article.notFound.body': 'This article ID is not in the blog index. Head back and pick another one.',
      'article.backToBlog': 'Back to Blog',
      'article.readingLabel': 'Reading',
      'article.prev': 'Previous Signal',
      'article.next': 'Next Signal',
      'article.loadFail.title': 'Load failed',
      'article.loadFail.body': 'Failed to load content. Please refresh and try again.',
      'article.translationMissing': 'This post has no English version yet — showing the Chinese original below.',

      // work
      'work.title': 'ALL WORKS',
      'work.subtitle': 'Explore my project universe',
      'work.loading': 'Loading works...',
      'work.empty': 'No works yet',
      'work.modal.loading.title': 'Loading...',
      'work.modal.loading.body': 'Loading content...',
      'work.modal.fail.title': 'Load failed',
      'work.modal.fail.body': 'Failed to load content. Please refresh and try again.',
    },
  };

  function detectLang() {
    const params = new URLSearchParams(location.search);
    const urlLang = params.get('lang');
    if (urlLang && SUPPORTED.includes(urlLang)) return urlLang;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (e) { /* localStorage may be unavailable */ }
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('en')) return 'en';
    return 'zh';
  }

  let currentLang = detectLang();
  document.documentElement.setAttribute('lang', currentLang === 'zh' ? 'zh-CN' : 'en');

  function t(key, vars) {
    let str = (dict[currentLang] && dict[currentLang][key]) || (dict.zh && dict.zh[key]) || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return str;
  }

  function applyDataI18n(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    (root || document).querySelectorAll('[data-i18n-attr]').forEach((el) => {
      // format: "attr1:key1; attr2:key2"
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  const listeners = new Set();
  function onLangChange(fn) { listeners.add(fn); }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === currentLang) return;
    currentLang = lang;
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    // 更新 URL（不刷新页面）
    const url = new URL(location.href);
    if (lang === 'zh') {
      url.searchParams.delete('lang');
    } else {
      url.searchParams.set('lang', lang);
    }
    history.replaceState(null, '', url.toString());
    applyDataI18n();
    listeners.forEach((fn) => {
      try { fn(lang); } catch (e) { console.error(e); }
    });
  }

  function bindToggle(btn) {
    if (!btn) return;
    function syncLabel() {
      btn.textContent = currentLang === 'zh' ? 'EN' : '中';
      const titleKey = currentLang === 'zh' ? 'lang.toggle.title.toEN' : 'lang.toggle.title.toZH';
      btn.setAttribute('aria-label', t(titleKey));
      btn.setAttribute('title', t(titleKey));
    }
    syncLabel();
    btn.addEventListener('click', () => {
      setLang(currentLang === 'zh' ? 'en' : 'zh');
      syncLabel();
    });
    onLangChange(syncLabel);
  }

  window.__I18N__ = {
    get lang() { return currentLang; },
    t,
    setLang,
    applyDataI18n,
    onLangChange,
    bindToggle,
    detectLang,
  };
})();
