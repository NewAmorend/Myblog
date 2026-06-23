(function () {
    const root = document.documentElement;
    const page = document.body.dataset.page || "home";

    const state = {
        posts: [],
        works: [],
        workCache: {}
    };

    const qs = (selector, scope = document) => scope.querySelector(selector);
    const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function parseFrontmatter(markdown) {
        const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!match) return { content: markdown };

        const frontmatter = {};
        match[1].split("\n").forEach((line) => {
            const colonIndex = line.indexOf(":");
            if (colonIndex === -1) return;
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim().replace(/^['"]|['"]$/g, "");
            frontmatter[key] = value;
        });

        return { ...frontmatter, content: match[2] };
    }

    async function fetchJSON(path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(path + " 加载失败：" + response.status);
        return response.json();
    }

    async function fetchText(path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(path + " 加载失败：" + response.status);
        return response.text();
    }

    function sortByDate(items) {
        return [...items].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }

    function initTheme() {
        const themeKey = "amorend-reading-theme";
        const saved = localStorage.getItem(themeKey) || "dark";
        root.setAttribute("data-theme", saved);

        function syncLabel() {
            const isDark = root.getAttribute("data-theme") === "dark";
            qsa("[data-theme-toggle]").forEach((button) => {
                button.setAttribute("aria-label", isDark ? "切换到亮色模式" : "切换到深色模式");
                button.setAttribute("title", isDark ? "切换到亮色模式" : "切换到深色模式");
            });
        }

        qsa("[data-theme-toggle]").forEach((button) => {
            button.addEventListener("click", () => {
                const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
                root.setAttribute("data-theme", nextTheme);
                localStorage.setItem(themeKey, nextTheme);
                syncLabel();
            });
        });

        syncLabel();
    }

    function initMenu() {
        const button = qs("[data-menu-toggle]");
        if (!button) return;

        button.addEventListener("click", () => {
            const isOpen = document.body.classList.toggle("menu-open");
            button.setAttribute("aria-expanded", String(isOpen));
        });

        qsa(".nav-links a").forEach((link) => {
            link.addEventListener("click", () => {
                document.body.classList.remove("menu-open");
                button.setAttribute("aria-expanded", "false");
            });
        });
    }

    async function loadPosts() {
        if (state.posts.length) return state.posts;
        state.posts = sortByDate(await fetchJSON("blog/index.json"));
        return state.posts;
    }

    async function loadWorks() {
        if (state.works.length) return state.works;
        state.works = await fetchJSON("work/index.json");
        return state.works;
    }

    function postCard(post) {
        return `
            <a class="post-item" href="article.html?post=${encodeURIComponent(post.id)}">
                <time datetime="${escapeHTML(post.date)}">${escapeHTML(post.date)}</time>
                <div>
                    <h2>${escapeHTML(post.title)}</h2>
                    <p>${escapeHTML(post.excerpt || "")}</p>
                </div>
                <span>${escapeHTML(post.tag)}</span>
            </a>
        `;
    }

    function workCard(work) {
        const tags = (work.tags || []).map((tag) => `<span>${escapeHTML(tag)}</span>`).join("");
        return `
            <button class="work-item" type="button" data-work="${escapeHTML(work.id)}">
                <span class="work-code">${escapeHTML(work.code || "")}</span>
                <strong>${escapeHTML(work.title)}</strong>
                <p>${escapeHTML(work.description || "")}</p>
                <small>${tags}</small>
            </button>
        `;
    }

    async function renderHome() {
        const target = qs("[data-home-posts]");
        const count = qs("[data-post-count]");
        if (!target) return;

        const posts = await loadPosts();
        if (count) count.textContent = String(posts.length);
        target.innerHTML = posts.slice(0, 8).map(postCard).join("");
    }

    async function renderBlog() {
        const target = qs("[data-blog-list]");
        const count = qs("[data-blog-count]");
        const bar = qs("[data-category-bar]");
        if (!target) return;

        const posts = await loadPosts();

        const renderList = (category) => {
            const filtered = category === "全部"
                ? posts
                : posts.filter((post) => (post.category || "工程") === category);
            if (count) count.textContent = String(filtered.length) + " 篇文章";
            target.innerHTML = filtered.length
                ? filtered.map(postCard).join("")
                : '<div class="loading-message">这个分类还没有文章。</div>';
        };

        if (bar) {
            const canonical = (bar.dataset.categories || "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
            const categories = ["全部", ...canonical];
            const active = bar.dataset.active && categories.includes(bar.dataset.active)
                ? bar.dataset.active
                : "全部";

            bar.innerHTML = categories.map((category) => {
                const n = category === "全部"
                    ? posts.length
                    : posts.filter((post) => (post.category || "工程") === category).length;
                return `
                    <button class="cat-btn${category === active ? " is-active" : ""}" type="button" data-cat="${escapeHTML(category)}">
                        <span class="cat-name">${escapeHTML(category)}</span>
                        <span class="cat-count">${n}</span>
                    </button>
                `;
            }).join("");

            qsa("[data-cat]", bar).forEach((button) => {
                button.addEventListener("click", () => {
                    const category = button.dataset.cat;
                    bar.dataset.active = category;
                    qsa(".cat-btn", bar).forEach((node) => {
                        node.classList.toggle("is-active", node.dataset.cat === category);
                    });
                    renderList(category);
                });
            });

            renderList(active);
        } else {
            renderList("全部");
        }
    }

    async function loadWork(workId) {
        if (state.workCache[workId]) return state.workCache[workId];

        const works = await loadWorks();
        const work = works.find((item) => item.id === workId);
        if (!work) return null;

        const markdown = await fetchText("work/" + work.file);
        const parsed = parseFrontmatter(markdown);
        const htmlContent = window.marked ? marked.parse(parsed.content || "") : "<pre>" + escapeHTML(parsed.content || "") + "</pre>";
        const result = { ...work, ...parsed, htmlContent };
        state.workCache[workId] = result;
        return result;
    }

    function openModal() {
        const overlay = qs("[data-modal-overlay]");
        if (!overlay) return;
        overlay.classList.add("active");
        document.body.classList.add("modal-open");
    }

    function closeModal() {
        const overlay = qs("[data-modal-overlay]");
        if (!overlay) return;
        overlay.classList.remove("active");
        document.body.classList.remove("modal-open");
    }

    async function openWorkModal(workId) {
        const title = qs("[data-modal-title]");
        const meta = qs("[data-modal-meta]");
        const body = qs("[data-modal-body]");
        if (!title || !meta || !body) return;

        title.textContent = "加载中";
        meta.textContent = "";
        body.innerHTML = "<p>内容加载中...</p>";
        openModal();

        const work = await loadWork(workId);
        if (!work) {
            title.textContent = "作品不存在";
            body.innerHTML = "<p>没有找到这个作品。</p>";
            return;
        }

        title.textContent = work.title;
        meta.textContent = work.code || "";
        body.innerHTML = work.htmlContent;
    }

    async function renderWorks() {
        const target = qs("[data-work-list]");
        const count = qs("[data-work-count]");
        if (!target) return;

        const works = await loadWorks();
        if (count) count.textContent = String(works.length) + " 个项目";
        target.innerHTML = works.map(workCard).join("");

        qsa("[data-work]", target).forEach((button) => {
            button.addEventListener("click", () => openWorkModal(button.dataset.work));
        });

        qsa("[data-modal-close]").forEach((button) => button.addEventListener("click", closeModal));
        const overlay = qs("[data-modal-overlay]");
        if (overlay) {
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) closeModal();
            });
        }
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeModal();
        });
    }

    function navCard(post, label) {
        if (!post) return "";
        return `
            <a class="next-card" href="article.html?post=${encodeURIComponent(post.id)}">
                <span>${escapeHTML(label)}</span>
                <strong>${escapeHTML(post.title)}</strong>
            </a>
        `;
    }

    function typesetMath(scope) {
        if (!window.MathJax) return;

        const run = () => {
            if (typeof window.MathJax.typesetPromise !== "function") return;
            window.MathJax.typesetPromise([scope]).catch((error) => {
                console.warn("MathJax 渲染失败", error);
            });
        };

        if (typeof window.MathJax.typesetPromise === "function") {
            run();
            return;
        }

        window.addEventListener("load", run, { once: true });
    }

    async function renderArticle() {
        const articleRoot = qs("[data-article-root]");
        if (!articleRoot) return;

        const posts = await loadPosts();
        const postId = new URLSearchParams(window.location.search).get("post") || "";
        const index = posts.findIndex((post) => post.id === postId);
        const post = posts[index];

        if (!post) {
            document.title = "文章不存在 - Amorend";
            articleRoot.innerHTML = `
                <article class="article-shell">
                    <a class="back-link" href="blog.html">返回文章列表</a>
                    <h1>文章不存在</h1>
                    <p>这个文章 ID 没有出现在博客索引里。</p>
                </article>
            `;
            return;
        }

        const markdown = await fetchText("blog/" + post.file);
        const parsed = parseFrontmatter(markdown);
        const article = { ...post, ...parsed };
        const htmlContent = window.marked ? marked.parse(article.content || "") : "<pre>" + escapeHTML(article.content || "") + "</pre>";

        document.title = article.title + " - Amorend";
        articleRoot.innerHTML = `
            <article class="article-shell">
                <a class="back-link" href="blog.html">返回文章列表</a>
                <header class="article-header">
                    <p class="article-meta">
                        <time datetime="${escapeHTML(article.date)}">${escapeHTML(article.date)}</time>
                        <span>${escapeHTML(article.tag)}</span>
                    </p>
                    <h1>${escapeHTML(article.title)}</h1>
                    <p>${escapeHTML(article.excerpt || "")}</p>
                </header>
                <div class="article-body">${htmlContent}</div>
                <nav class="article-nav" aria-label="相邻文章">
                    ${navCard(posts[index + 1], "上一篇")}
                    ${navCard(posts[index - 1], "下一篇")}
                </nav>
            </article>
        `;

        typesetMath(articleRoot);
    }

    function renderError(error) {
        console.error(error);
        qsa("[data-loading]").forEach((node) => {
            node.innerHTML = "<p>内容加载失败，请确认本地服务已启动后刷新页面。</p>";
        });
    }

    async function initPage() {
        if (page === "home") await renderHome();
        if (page === "blog") await renderBlog();
        if (page === "work") await renderWorks();
        if (page === "article") await renderArticle();
    }

    initTheme();
    initMenu();
    initPage().catch(renderError);
})();
