(function () {
  let theme = 'light';
  let language = 'zh';
  try {
    theme = localStorage.getItem('amorend-reading-theme') === 'dark' ? 'dark' : 'light';
    language = localStorage.getItem('amorend.lang') === 'en' ? 'en' : 'zh';
  } catch { /* 存储不可用时使用可读的浅色中文界面。 */ }
  const requested = new URLSearchParams(location.search).get('lang');
  if (requested === 'en' || requested === 'zh') language = requested;
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
})();
