window.MathJax = {
  loader: { load: ['ui/safe'] },
  tex: {
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    inlineMath: [['\\(', '\\)']]
  },
  svg: { fontCache: 'global' },
  options: {
    enableMenu: false,
    enableAssistiveMml: false,
    safeOptions: { allow: { URLs: 'safe', classes: 'none', cssIDs: 'none', styles: 'none' } }
  },
  startup: { typeset: false }
};
