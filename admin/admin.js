(function () {
  'use strict';

  const elements = {
    loginView: document.querySelector('[data-login-view]'),
    loginForm: document.querySelector('[data-login-form]'),
    loginError: document.querySelector('[data-login-error]'),
    appView: document.querySelector('[data-app-view]'),
    repository: document.querySelector('[data-repository]'),
    logout: document.querySelector('[data-logout]'),
    newContent: document.querySelector('[data-new-content]'),
    newLabel: document.querySelector('[data-new-label]'),
    emptyNew: document.querySelector('[data-empty-new]'),
    emptyTitle: document.querySelector('[data-empty-title]'),
    emptyCopy: document.querySelector('[data-empty-copy]'),
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
    sidebarScrim: document.querySelector('[data-sidebar-scrim]'),
    libraryModes: [...document.querySelectorAll('[data-library-mode]')],
    postSeries: document.querySelector('[data-post-series]'),
    seriesHint: document.querySelector('[data-series-hint]'),
    seriesEditor: document.querySelector('[data-series-editor]'),
    seriesForm: document.querySelector('[data-series-form]'),
    seriesTitle: document.querySelector('[data-series-title]'),
    seriesId: document.querySelector('[data-series-id]'),
    seriesDescription: document.querySelector('[data-series-description]'),
    seriesPrerequisites: document.querySelector('[data-series-prerequisites]'),
    seriesChapterCount: document.querySelector('[data-series-chapter-count]'),
    seriesSaveState: document.querySelector('[data-series-save-state]'),
    seriesLiveLink: document.querySelector('[data-series-live-link]'),
    chapterPicker: document.querySelector('[data-chapter-picker]'),
    chapterList: document.querySelector('[data-chapter-list]'),
    chapterEmpty: document.querySelector('[data-chapter-empty]'),
    addChapter: document.querySelector('[data-add-chapter]'),
    deleteSeries: document.querySelector('[data-delete-series]')
  };

  const state = {
    csrf: '',
    posts: [],
    series: [],
    libraryMode: 'posts',
    currentSeries: null,
    seriesDirty: false,
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
    await task(refreshLibrary);
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
    if (state.libraryMode === 'series') {
      const collections = state.series.filter((item) => !query || `${item.title} ${item.description} ${item.id}`.toLowerCase().includes(query));
      elements.postCount.textContent = `${state.series.length} 个系列`;
      elements.postList.setAttribute('aria-label', '系列列表');
      elements.postList.innerHTML = collections.length ? collections.map((item) => `
        <button class="post-button${state.currentSeries?.id === item.id ? ' is-active' : ''}" type="button" data-series-id="${escapeHTML(item.id)}">
          <strong>${escapeHTML(item.title || '未命名系列')}</strong>
          <span class="post-footer"><span>${escapeHTML(item.chapterCount)} 章</span><span class="post-status">已发布</span></span>
        </button>`).join('') : '<p class="post-list-empty">还没有系列。</p>';
      return;
    }
    const posts = state.posts.filter((post) => {
      const seriesTitle = state.series.find((item) => item.id === post.seriesId)?.title || '';
      const haystack = `${post.title} ${post.tag} ${post.category} ${post.id} ${seriesTitle}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    elements.postCount.textContent = `${state.posts.length} 篇内容`;
    elements.postList.setAttribute('aria-label', '文章列表');

    if (!posts.length) {
      elements.postList.innerHTML = '<p class="post-list-empty">没有匹配的文章。</p>';
      return;
    }

    elements.postList.innerHTML = posts.map((post) => `
      <button class="post-button${state.current?.post?.id === post.id ? ' is-active' : ''}" type="button" data-post-id="${escapeHTML(post.id)}">
        <strong>${escapeHTML(post.title || '未命名文章')}</strong>
        <span class="post-footer">
          <span>${escapeHTML(post.date || '未定日期')} · ${escapeHTML(state.series.find((item) => item.id === post.seriesId)?.title || post.tag || '独立文章')}</span>
          <span class="post-status ${escapeHTML(post.status)}">${statusLabel(post)}</span>
        </span>
      </button>
    `).join('');
  }

  function renderSeriesOptions() {
    const selected = elements.postSeries.value;
    elements.postSeries.innerHTML = '<option value="">独立文章</option>' + state.series.map((item) =>
      `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)}</option>`).join('');
    elements.postSeries.value = state.series.some((item) => item.id === selected) ? selected : '';
  }

  async function refreshLibrary() {
    const [postResult, seriesResult] = await Promise.all([api('/api/admin/posts'), api('/api/admin/series')]);
    state.posts = postResult.posts || [];
    state.series = seriesResult.series || [];
    renderSeriesOptions();
    renderPostList();
  }

  async function refreshPosts() { return refreshLibrary(); }

  function updateLibraryMode(mode) {
    if (!['posts', 'series'].includes(mode) || mode === state.libraryMode) return;
    if (!confirmDiscard()) return;
    state.libraryMode = mode;
    elements.libraryModes.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.libraryMode === mode)));
    elements.newLabel.textContent = mode === 'series' ? '新建系列' : '新建文章';
    elements.search.placeholder = mode === 'series' ? '搜索系列…' : '搜索标题、标签…';
    elements.emptyTitle.textContent = mode === 'series' ? '选一个系列，或者建立新的目录。' : '选一篇文章，或者从空白开始。';
    elements.emptyCopy.textContent = mode === 'series' ? '系列负责组织简介与章节顺序；正文仍在文章编辑器中完成。' : '草稿保存在本机；点击发布后，才会进入公开文章列表。';
    elements.emptyNew.textContent = mode === 'series' ? '新建系列' : '写新文章';
    elements.search.value = '';
    clearEditor();
  }

  function seriesIsPersisted() {
    return Boolean(state.currentSeries && state.series.some((item) => item.id === state.currentSeries.id));
  }

  function setSeriesDirty(value = true) {
    state.seriesDirty = value;
    elements.seriesSaveState.textContent = value ? '有未发布的修改' : '已与线上同步';
    elements.seriesSaveState.style.color = value ? 'var(--amber)' : '';
  }

  function renderChapterEditor() {
    if (!state.currentSeries) return;
    const chapters = state.currentSeries.chapters || [];
    const published = state.posts.filter((post) => post.published);
    const byId = new Map(published.map((post) => [post.id, post]));
    elements.seriesChapterCount.textContent = `${chapters.length} 章`;
    elements.chapterList.innerHTML = chapters.map((id, index) => {
      const post = byId.get(id);
      return `<li class="chapter-row" data-chapter-id="${escapeHTML(id)}"><div><strong>${escapeHTML(post?.title || id)}</strong><small>${escapeHTML(id)}</small></div><div class="chapter-actions"><button type="button" data-chapter-action="up" aria-label="上移" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-chapter-action="down" aria-label="下移" ${index === chapters.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-chapter-action="remove" aria-label="移出系列">×</button></div></li>`;
    }).join('');
    elements.chapterEmpty.hidden = chapters.length > 0;
    const used = new Set(state.series.flatMap((item) => item.id === state.currentSeries.id ? [] : (item.chapters || [])));
    const available = published.filter((post) => !chapters.includes(post.id) && !used.has(post.id));
    elements.chapterPicker.innerHTML = available.length
      ? available.map((post) => `<option value="${escapeHTML(post.id)}">${escapeHTML(post.title)}</option>`).join('')
      : '<option value="">没有可加入的已发布文章</option>';
    elements.addChapter.disabled = !available.length;
  }

  function setSeriesForm(item, persisted = true) {
    state.currentSeries = { ...item, chapters: [...(item.chapters || [])] };
    elements.seriesForm.elements.title.value = item.title || '';
    elements.seriesForm.elements.id.value = item.id || '';
    elements.seriesForm.elements.description.value = item.description || '';
    elements.seriesForm.elements.prerequisites.value = item.prerequisites || '';
    elements.seriesId.readOnly = persisted;
    elements.editorEmpty.hidden = true;
    elements.editor.hidden = true;
    elements.seriesEditor.hidden = false;
    elements.seriesLiveLink.hidden = !persisted;
    elements.seriesLiveLink.href = `../series.html?series=${encodeURIComponent(item.id)}`;
    elements.deleteSeries.hidden = !persisted;
    setSeriesDirty(!persisted);
    renderChapterEditor();
    renderPostList();
  }

  async function openSeries(id) {
    if (!confirmDiscard()) return;
    await task(async () => {
      const result = await api(`/api/admin/series?id=${encodeURIComponent(id)}`);
      setSeriesForm(result.series, true);
      document.body.classList.remove('sidebar-open');
    });
  }

  function newSeries() {
    if (!confirmDiscard()) return;
    setSeriesForm({ id: `series-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`, title: '', description: '', prerequisites: '', chapters: [] }, false);
    elements.seriesTitle.focus();
    document.body.classList.remove('sidebar-open');
  }

  function confirmDiscard() {
    return (!state.dirty && !state.seriesDirty) || window.confirm('当前修改还没有保存，确定离开吗？');
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
      *{box-sizing:border-box}body{max-width:740px;margin:0 auto;padding:42px 34px 80px;background:#fff;color:#202020;font:17px/1.95 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif}h1{margin:0 0 38px;font-size:38px;line-height:1.45}h2,h3{margin:1.8em 0 .7em;line-height:1.4}h2{font-size:26px}h3{font-size:21px}p{margin:0 0 1.4em}a{color:inherit;text-underline-offset:4px}img{max-width:100%;height:auto}blockquote{margin:1.6em 0;padding:0 20px;border-left:2px solid #e5e5e5;color:#666}pre{overflow:auto;padding:18px;background:#f6f6f6;font:14px/1.7 ui-monospace,monospace}code{font-family:ui-monospace,monospace;font-size:.88em}p code,li code{padding:2px 4px;background:#f6f6f6}table{width:100%;border-collapse:collapse}th,td{padding:10px 14px;border:1px solid #e5e5e5;text-align:left}hr{border:0;border-top:1px solid #e5e5e5;margin:36px 0}</style></head><body><h1>${title}</h1>${rendered}</body></html>`;
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
    renderSeriesOptions();
    elements.form.elements.seriesId.value = post.seriesId || '';
    elements.seriesHint.textContent = post.seriesId
      ? `当前是「${state.series.find((item) => item.id === post.seriesId)?.title || post.seriesId}」的章节。章节顺序可在“系列”中调整。`
      : '独立文章会显示在“文章”入口；选择系列后，发布时会自动追加为该系列的最后一章。';
    elements.editorEmpty.hidden = true;
    elements.editor.hidden = false;
    elements.seriesEditor.hidden = true;
    state.currentSeries = null;
    state.seriesDirty = false;
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
      post: { id: dateSlug(), title: '', date: new Date().toISOString().slice(0, 10), tag: 'Notes', category: '工程', excerpt: '', content: '', seriesId: '' },
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
      content: elements.form.elements.content.value,
      seriesId: elements.form.elements.seriesId.value
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
    state.currentSeries = null;
    state.dirty = false;
    state.seriesDirty = false;
    elements.editor.hidden = true;
    elements.seriesEditor.hidden = true;
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

  async function publishSeriesForm() {
    if (!elements.seriesForm.reportValidity()) return;
    const item = {
      id: elements.seriesForm.elements.id.value.trim(),
      title: elements.seriesForm.elements.title.value.trim(),
      description: elements.seriesForm.elements.description.value.trim(),
      prerequisites: elements.seriesForm.elements.prerequisites.value.trim(),
      chapters: [...(state.currentSeries?.chapters || [])]
    };
    await task(async () => {
      const result = await api('/api/admin/series', { method: 'PUT', body: { series: item } });
      toast(result.created ? '系列已创建，站点正在重新部署' : '系列目录已更新，站点正在重新部署');
      await refreshLibrary();
      setSeriesForm(result.series, true);
    });
  }

  async function deleteSeries() {
    if (!state.currentSeries || !window.confirm('确定下线这个系列吗？章节正文会保留，并重新显示为独立文章。')) return;
    const id = state.currentSeries.id;
    await task(async () => {
      await api('/api/admin/series', { method: 'DELETE', body: { id } });
      toast('系列已下线，章节正文仍然保留');
      await refreshLibrary();
      clearEditor();
    });
  }

  function changeChapter(id, action) {
    if (!state.currentSeries) return;
    const chapters = state.currentSeries.chapters;
    const index = chapters.indexOf(id);
    if (index === -1) return;
    if (action === 'remove') chapters.splice(index, 1);
    if (action === 'up' && index > 0) [chapters[index - 1], chapters[index]] = [chapters[index], chapters[index - 1]];
    if (action === 'down' && index < chapters.length - 1) [chapters[index + 1], chapters[index]] = [chapters[index], chapters[index + 1]];
    setSeriesDirty();
    renderChapterEditor();
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
  elements.libraryModes.forEach((button) => button.addEventListener('click', () => updateLibraryMode(button.dataset.libraryMode)));
  elements.newContent.addEventListener('click', () => state.libraryMode === 'series' ? newSeries() : newPost());
  elements.emptyNew.addEventListener('click', () => state.libraryMode === 'series' ? newSeries() : newPost());
  elements.search.addEventListener('input', renderPostList);
  elements.postList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-post-id]');
    if (button) openPost(button.dataset.postId);
    const seriesButton = event.target.closest('[data-series-id]');
    if (seriesButton) openSeries(seriesButton.dataset.seriesId);
  });
  elements.save.addEventListener('click', () => saveDraft());
  elements.publish.addEventListener('click', publish);
  elements.deleteDraft.addEventListener('click', removeDraft);
  elements.unpublish.addEventListener('click', unpublish);
  elements.uploadButton.addEventListener('click', () => elements.imageInput.click());
  elements.imageInput.addEventListener('change', () => uploadImage(elements.imageInput.files[0]));
  elements.sidebarToggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  elements.sidebarScrim.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  elements.seriesForm.addEventListener('submit', (event) => { event.preventDefault(); publishSeriesForm(); });
  elements.seriesForm.addEventListener('input', () => setSeriesDirty());
  elements.seriesTitle.addEventListener('input', () => {
    if (!seriesIsPersisted()) {
      const slug = slugify(elements.seriesTitle.value);
      if (slug) elements.seriesId.value = slug;
    }
  });
  elements.addChapter.addEventListener('click', () => {
    const id = elements.chapterPicker.value;
    if (!id || !state.currentSeries) return;
    state.currentSeries.chapters.push(id);
    setSeriesDirty();
    renderChapterEditor();
  });
  elements.chapterList.addEventListener('click', (event) => {
    const action = event.target.closest('[data-chapter-action]');
    const row = event.target.closest('[data-chapter-id]');
    if (action && row) changeChapter(row.dataset.chapterId, action.dataset.chapterAction);
  });
  elements.deleteSeries.addEventListener('click', deleteSeries);
  elements.postSeries.addEventListener('change', () => {
    const title = state.series.find((item) => item.id === elements.postSeries.value)?.title;
    elements.seriesHint.textContent = title
      ? `发布后会追加为「${title}」的最后一章；之后可在“系列”中调整顺序。`
      : '独立文章会显示在“文章”入口。';
  });

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
    if (!state.dirty && !state.seriesDirty) return;
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
