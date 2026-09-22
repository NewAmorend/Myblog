(function () {
  'use strict';

  const elements = {
    loginView: document.querySelector('[data-login-view]'),
    loginForm: document.querySelector('[data-login-form]'),
    loginError: document.querySelector('[data-login-error]'),
    appView: document.querySelector('[data-app-view]'),
    repository: document.querySelector('[data-repository]'),
    logout: document.querySelector('[data-logout]'),
    newPost: document.querySelector('[data-new-post]'),
    emptyNew: document.querySelector('[data-empty-new]'),
    search: document.querySelector('[data-search]'),
    postCount: document.querySelector('[data-post-count]'),
    postList: document.querySelector('[data-post-list]'),
    editorEmpty: document.querySelector('[data-editor-empty]'),
    editor: document.querySelector('[data-editor]'),
    form: document.querySelector('[data-editor-form]'),
    title: document.querySelector('[data-title]'),
    id: document.querySelector('[data-id]'),
    content: document.querySelector('[data-content]'),
    preview: document.querySelector('[data-preview]'),
    writingGrid: document.querySelector('[data-writing-grid]'),
    status: document.querySelector('[data-status]'),
    saveState: document.querySelector('[data-save-state]'),
    save: document.querySelector('[data-save]'),
    publish: document.querySelector('[data-publish]'),
    liveLink: document.querySelector('[data-live-link]'),
    deleteDraft: document.querySelector('[data-delete-draft]'),
    unpublish: document.querySelector('[data-unpublish]'),
    uploadButton: document.querySelector('[data-upload-button]'),
    imageInput: document.querySelector('[data-image-input]'),
    wordCount: document.querySelector('[data-word-count]'),
    toast: document.querySelector('[data-toast]'),
    busy: document.querySelector('[data-busy]'),
    sidebarToggle: document.querySelector('[data-sidebar-toggle]'),
    sidebarScrim: document.querySelector('[data-sidebar-scrim]')
  };

  const state = {
    csrf: '',
    posts: [],
    current: null,
    dirty: false,
    busy: false,
    slugTouched: false,
    previewTimer: null,
    toastTimer: null
  };

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function api(path, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body && typeof options.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    if (state.csrf && options.method && options.method !== 'GET') headers['X-Admin-CSRF'] = state.csrf;

    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `请求失败（${response.status}）`);
      error.status = response.status;
      error.details = payload.details;
      throw error;
    }
    return payload;
  }

  function showLogin(message = '') {
    state.csrf = '';
    state.current = null;
    elements.appView.hidden = true;
    elements.loginView.hidden = false;
    elements.loginError.textContent = message;
    const password = elements.loginForm.elements.password;
    password.value = '';
    window.setTimeout(() => password.focus(), 50);
  }

  async function showApp(session) {
    state.csrf = session.csrf;
    if (session.repository) {
      elements.repository.textContent = `${session.repository.owner}/${session.repository.repo} · ${session.repository.branch}`;
    }
    elements.loginView.hidden = true;
    elements.appView.hidden = false;
    await task(refreshPosts);
  }

  function toast(message, type = 'success') {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle('error', type === 'error');
    elements.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 4200);
  }

  function errorMessage(error) {
    return error.details ? `${error.message}：${error.details}` : error.message;
  }

  async function task(operation) {
    if (state.busy) return null;
    state.busy = true;
    elements.busy.hidden = false;
    try {
      return await operation();
    } catch (error) {
      if (error.status === 401) showLogin('登录已失效，请重新登录。');
      else toast(errorMessage(error), 'error');
      return null;
    } finally {
      state.busy = false;
      elements.busy.hidden = true;
    }
  }

  function statusLabel(post) {
    if (post.status === 'changed') return '有未发布修改';
    if (post.status === 'draft') return '草稿';
    return '已发布';
  }

  function renderPostList() {
    const query = elements.search.value.trim().toLowerCase();
    const posts = state.posts.filter((post) => {
      const haystack = `${post.title} ${post.tag} ${post.category} ${post.id}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    elements.postCount.textContent = `${state.posts.length} 篇内容`;

    if (!posts.length) {
      elements.postList.innerHTML = '<p class="post-list-empty">没有匹配的文章。</p>';
      return;
    }

    elements.postList.innerHTML = posts.map((post) => `
      <button class="post-button${state.current?.post?.id === post.id ? ' is-active' : ''}" type="button" data-post-id="${escapeHTML(post.id)}">
        <strong>${escapeHTML(post.title || '未命名文章')}</strong>
        <span class="post-footer">
          <span>${escapeHTML(post.date || '未定日期')} · ${escapeHTML(post.tag || '无标签')}</span>
          <span class="post-status ${escapeHTML(post.status)}">${statusLabel(post)}</span>
        </span>
      </button>
    `).join('');
  }

  async function refreshPosts() {
    const result = await api('/api/admin/posts');
    state.posts = result.posts || [];
    renderPostList();
  }

  function confirmDiscard() {
    return !state.dirty || window.confirm('当前修改还没有保存，确定离开吗？');
  }

  function resizeTitle() {
    elements.title.style.height = 'auto';
    elements.title.style.height = `${Math.max(58, elements.title.scrollHeight)}px`;
  }

  function updateWordCount() {
    const value = elements.content.value;
    const chinese = (value.match(/[\u3400-\u9fff]/g) || []).length;
    const words = (value.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9_]+(?:[-'][A-Za-z0-9_]+)*/g) || []).length;
    elements.wordCount.textContent = `${chinese + words} 字`;
  }

  function previewDocument() {
    const markdown = elements.content.value;
    const rendered = window.renderSafeMarkdown
      ? window.renderSafeMarkdown(markdown)
      : `<pre>${escapeHTML(markdown)}</pre>`;
    const title = escapeHTML(elements.title.value || '未命名文章');
    elements.preview.srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><base href="${location.origin}/"><style>
      *{box-sizing:border-box}body{max-width:760px;margin:0 auto;padding:42px 34px 80px;background:#f2f0e9;color:#23252a;font:16px/1.82 Georgia,'Noto Serif SC',serif}h1{margin:0 0 38px;font-size:42px;line-height:1.08}h2,h3{margin:2em 0 .65em;line-height:1.3}h2{font-size:28px}h3{font-size:21px}p{margin:0 0 1.2em}a{color:#345fae}img{max-width:100%;height:auto;border-radius:4px}blockquote{margin:1.6em 0;padding:.1em 1.2em;border-left:3px solid #6c88ba;color:#5d616a}pre{overflow:auto;padding:18px;border-radius:6px;background:#1d2026;color:#e8e8e5;font:13px/1.7 ui-monospace,monospace}code{font-family:ui-monospace,monospace;font-size:.88em}p code,li code{padding:.12em .35em;border-radius:3px;background:#dedbd2}table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;border:1px solid #cbc8bf;text-align:left}hr{border:0;border-top:1px solid #cbc8bf;margin:2.5em 0}</style></head><body><h1>${title}</h1>${rendered}</body></html>`;
  }

  function schedulePreview() {
    window.clearTimeout(state.previewTimer);
    state.previewTimer = window.setTimeout(previewDocument, 180);
  }

  function setDirty(value = true) {
    state.dirty = value;
    elements.saveState.textContent = value ? '有未保存的更改' : '所有更改已保存';
    elements.saveState.style.color = value ? 'var(--amber)' : '';
    elements.publish.disabled = !value && state.current?.state === 'published';
  }

  function updateEditorState() {
    const current = state.current;
    if (!current) return;
    const hasDraft = current.state === 'draft';
    const changed = hasDraft && current.published;
    elements.status.textContent = changed ? '待发布修改' : current.published ? '已发布' : '草稿';
    elements.status.className = `status-pill${changed ? ' changed' : current.published ? ' published' : ''}`;
    elements.liveLink.hidden = !current.published;
    elements.liveLink.href = `../article.html?post=${encodeURIComponent(current.post.id)}`;
    elements.deleteDraft.hidden = !hasDraft;
    elements.unpublish.hidden = !current.published;
    elements.publish.textContent = current.published ? '更新发布' : '发布';
    elements.id.readOnly = Boolean(current.persisted);
    elements.publish.disabled = !state.dirty && current.state === 'published';
  }

  function setFormPost(current) {
    state.current = current;
    const post = current.post;
    elements.form.elements.title.value = post.title || '';
    elements.form.elements.id.value = post.id || '';
    elements.form.elements.date.value = post.date || new Date().toISOString().slice(0, 10);
    elements.form.elements.tag.value = post.tag || '';
    elements.form.elements.category.value = post.category || '工程';
    elements.form.elements.excerpt.value = post.excerpt || '';
    elements.form.elements.content.value = post.content || '';
    elements.editorEmpty.hidden = true;
    elements.editor.hidden = false;
    state.slugTouched = Boolean(current.persisted);
    setDirty(false);
    resizeTitle();
    updateWordCount();
    updateEditorState();
    previewDocument();
    renderPostList();
  }

  async function openPost(id) {
    if (!confirmDiscard()) return;
    await task(async () => {
      const result = await api(`/api/admin/post?id=${encodeURIComponent(id)}`);
      setFormPost({ ...result, persisted: true });
      document.body.classList.remove('sidebar-open');
    });
  }

  function dateSlug() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    return `post-${date}-${time}`;
  }

  function newPost() {
    if (!confirmDiscard()) return;
    setFormPost({
      post: { id: dateSlug(), title: '', date: new Date().toISOString().slice(0, 10), tag: 'Notes', category: '工程', excerpt: '', content: '' },
      state: 'draft',
      published: false,
      persisted: false
    });
    state.slugTouched = false;
    elements.id.readOnly = false;
    setDirty(true);
    elements.title.focus();
    document.body.classList.remove('sidebar-open');
  }

  function gatherPost() {
    if (!elements.form.reportValidity()) return null;
    return {
      id: elements.form.elements.id.value.trim(),
      title: elements.form.elements.title.value.trim(),
      date: elements.form.elements.date.value,
      tag: elements.form.elements.tag.value.trim(),
      category: elements.form.elements.category.value,
      excerpt: elements.form.elements.excerpt.value.trim(),
      content: elements.form.elements.content.value
    };
  }

  async function saveDraft(options = {}) {
    const post = gatherPost();
    if (!post) return false;
    let saved = false;
    await task(async () => {
      const result = await api('/api/admin/post', { method: 'PUT', body: { post } });
      state.current = {
        post: result.post,
        state: 'draft',
        published: Boolean(state.current?.published),
        persisted: true
      };
      setDirty(false);
      updateEditorState();
      await refreshPosts();
      if (!options.silent) toast('草稿已私密保存');
      saved = true;
    });
    return saved;
  }

  async function publish() {
    if (!state.current) return;
    if (state.dirty || state.current.state !== 'draft') {
      const saved = await saveDraft({ silent: true });
      if (!saved) return;
    }
    const id = state.current.post.id;
    await task(async () => {
      const result = await api('/api/admin/publish', { method: 'POST', body: { id } });
      toast(result.created ? '文章已发布，站点正在重新部署' : '文章更新已发布，站点正在重新部署');
      await refreshPosts();
      const fresh = await api(`/api/admin/post?id=${encodeURIComponent(id)}`);
      setFormPost({ ...fresh, persisted: true });
    });
  }

  async function removeDraft() {
    if (!state.current || !window.confirm('确定删除这份草稿吗？')) return;
    const id = state.current.post.id;
    await task(async () => {
      await api('/api/admin/post', { method: 'DELETE', body: { id, kind: 'draft' } });
      toast('草稿已删除');
      await refreshPosts();
      if (state.current.published) {
        const fresh = await api(`/api/admin/post?id=${encodeURIComponent(id)}`);
        setFormPost({ ...fresh, persisted: true });
      } else {
        clearEditor();
      }
    });
  }

  async function unpublish() {
    if (!state.current || !window.confirm('确定下线这篇文章吗？公开 Markdown 和索引条目会被删除，但仍可从 Git 历史恢复。')) return;
    const id = state.current.post.id;
    await task(async () => {
      await api('/api/admin/post', { method: 'DELETE', body: { id, kind: 'published' } });
      toast('文章已下线，站点正在重新部署');
      await refreshPosts();
      clearEditor();
    });
  }

  function clearEditor() {
    state.current = null;
    state.dirty = false;
    elements.editor.hidden = true;
    elements.editorEmpty.hidden = false;
    renderPostList();
  }

  function insertText(text, prefix = false) {
    const textarea = elements.content;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (prefix) {
      const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
      textarea.setRangeText(text, lineStart, lineStart, 'end');
    } else {
      textarea.setRangeText(text, start, end, 'select');
    }
    textarea.focus();
    setDirty();
    updateWordCount();
    schedulePreview();
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast('图片不能超过 3 MB', 'error');
      return;
    }
    await task(async () => {
      const data = await readFileAsBase64(file);
      const result = await api('/api/admin/upload', { method: 'POST', body: { name: file.name, type: file.type, data } });
      insertText(`\n${result.markdown}\n`);
      toast('图片已上传，并插入正文');
    });
    elements.imageInput.value = '';
  }

  function slugify(value) {
    return value.toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.loginError.textContent = '';
    const password = elements.loginForm.elements.password.value;
    const button = elements.loginForm.querySelector('button');
    button.disabled = true;
    try {
      const session = await api('/api/admin/login', { method: 'POST', body: { password } });
      await showApp(session);
    } catch (error) {
      elements.loginError.textContent = errorMessage(error);
    } finally {
      button.disabled = false;
    }
  });
  // 防止脚本尚未就绪时浏览器原生提交表单，将密码带入 URL。
  elements.loginForm.querySelector('button[type="submit"]').disabled = false;

  elements.logout.addEventListener('click', async () => {
    if (!confirmDiscard()) return;
    try {
      await api('/api/admin/logout', { method: 'POST' });
      showLogin();
    } catch (error) {
      if (error.status === 401) showLogin();
      else toast(errorMessage(error), 'error');
    }
  });
  elements.newPost.addEventListener('click', newPost);
  elements.emptyNew.addEventListener('click', newPost);
  elements.search.addEventListener('input', renderPostList);
  elements.postList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-post-id]');
    if (button) openPost(button.dataset.postId);
  });
  elements.save.addEventListener('click', () => saveDraft());
  elements.publish.addEventListener('click', publish);
  elements.deleteDraft.addEventListener('click', removeDraft);
  elements.unpublish.addEventListener('click', unpublish);
  elements.uploadButton.addEventListener('click', () => elements.imageInput.click());
  elements.imageInput.addEventListener('change', () => uploadImage(elements.imageInput.files[0]));
  elements.sidebarToggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  elements.sidebarScrim.addEventListener('click', () => document.body.classList.remove('sidebar-open'));

  elements.form.addEventListener('input', (event) => {
    if (!state.current) return;
    setDirty();
    if (event.target === elements.title) {
      resizeTitle();
      if (!state.slugTouched && !state.current.persisted) {
        const slug = slugify(elements.title.value);
        if (slug) elements.id.value = slug;
      }
    }
    if (event.target === elements.content) updateWordCount();
    schedulePreview();
  });
  elements.id.addEventListener('input', () => { state.slugTouched = true; });

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
      elements.writingGrid.dataset.view = button.dataset.mode;
      if (button.dataset.mode !== 'write') previewDocument();
    });
  });
  document.querySelectorAll('[data-insert]').forEach((button) => button.addEventListener('click', () => insertText(button.dataset.insert)));
  document.querySelectorAll('[data-prefix]').forEach((button) => button.addEventListener('click', () => insertText(button.dataset.prefix, true)));

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (state.current) saveDraft();
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  (async function boot() {
    try {
      const session = await api('/api/admin/session');
      await showApp(session);
    } catch (error) {
      showLogin(error.status === 503 ? errorMessage(error) : '');
    }
  })();
})();
