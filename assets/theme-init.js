(function () {
  try {
    const saved = localStorage.getItem('amorend-reading-theme');
    document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
  } catch { /* 存储被禁用时沿用默认主题。 */ }
})();
