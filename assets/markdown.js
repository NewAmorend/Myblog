(function () {
  const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  window.renderSafeMarkdown = (markdown) => {
    const source = String(markdown || '');
    // 任一依赖缺失时展示纯文本，禁止降级为未净化的 HTML。
    if (!window.marked || !window.DOMPurify?.isSupported) return `<pre>${escape(source)}</pre>`;
    return window.DOMPurify.sanitize(window.marked.parse(source, { gfm: true, breaks: false }), {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
      FORBID_ATTR: ['style', 'srcset'],
      SANITIZE_NAMED_PROPS: true
    });
  };
})();
