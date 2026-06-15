(function () {
    const root = document.documentElement;
    const page = document.body.dataset.page || "home";
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasGSAP = Boolean(window.gsap);
    let modalScrollY = 0;

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

    function escapeSelectorValue(value) {
        if (window.CSS && typeof CSS.escape === "function") return CSS.escape(value);
        return String(value).replace(/["\\]/g, "\\$&");
    }

    function initTheme() {
        const themeKey = "amorend-geometry-theme";
        const saved = localStorage.getItem(themeKey);
        if (saved) {
            root.setAttribute("data-theme", saved);
        }

        const syncLabel = () => {
            const toggle = qs("[data-theme-toggle]");
            if (!toggle) return;
            const isLight = root.getAttribute("data-theme") === "light";
            toggle.setAttribute("aria-label", isLight ? "切换到深色模式" : "切换到亮色模式");
            toggle.setAttribute("title", isLight ? "切换到深色模式" : "切换到亮色模式");
        };

        syncLabel();
        qsa("[data-theme-toggle]").forEach((button) => {
            button.addEventListener("click", () => {
                const nextTheme = root.getAttribute("data-theme") === "light" ? "dark" : "light";
                root.setAttribute("data-theme", nextTheme);
                localStorage.setItem(themeKey, nextTheme);
                syncLabel();
            });
        });
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

    function splitText() {
        qsa("[data-split]").forEach((node) => {
            if (node.dataset.splitReady === "true") return;
            const text = node.textContent || "";
            node.setAttribute("aria-label", text);
            node.textContent = "";
            Array.from(text).forEach((char) => {
                const span = document.createElement("span");
                span.className = "split-char";
                span.setAttribute("aria-hidden", "true");
                span.innerHTML = char === " " ? "&nbsp;" : escapeHTML(char);
                node.appendChild(span);
            });
            node.dataset.splitReady = "true";
        });
    }

    function initBackgroundMotion() {
        if (document.body.dataset.backgroundReady === "true") return;
        document.body.dataset.backgroundReady = "true";

        const backdrop = document.createElement("div");
        backdrop.className = "ambient-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        backdrop.innerHTML = `
            <span class="backdrop-shape backdrop-orbit"></span>
            <span class="backdrop-shape backdrop-orbit is-alt"></span>
            <span class="backdrop-shape backdrop-capsule"></span>
            <span class="backdrop-shape backdrop-line"></span>
            <span class="backdrop-shape backdrop-axis"></span>
            <span class="backdrop-shape backdrop-dots"></span>
            <span class="backdrop-shape backdrop-scan"></span>
            <span class="backdrop-shape backdrop-node is-one"></span>
            <span class="backdrop-shape backdrop-node is-two"></span>
        `;
        document.body.prepend(backdrop);

        if (!hasGSAP || prefersReducedMotion) return;

        const shapes = qsa(".backdrop-shape", backdrop);
        const ambient = gsap.timeline({
            repeat: -1,
            yoyo: true,
            defaults: { ease: "sine.inOut" }
        });

        gsap.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 0.78, duration: 1.2, ease: "power2.out" });
        ambient
            .to(qsa(".backdrop-orbit", backdrop), {
                x: (index) => (index ? -34 : 42),
                y: (index) => (index ? 28 : -24),
                rotation: (index) => (index ? -28 : 32),
                scale: (index) => (index ? 0.9 : 1.1),
                duration: 7.8,
                stagger: 0.35
            }, 0)
            .to(qsa(".backdrop-capsule", backdrop), {
                x: -70,
                y: 34,
                rotation: -6,
                scaleX: 1.16,
                duration: 6.8
            }, 0)
            .to(qsa(".backdrop-line", backdrop), {
                x: 96,
                scaleX: 1.42,
                autoAlpha: 0.9,
                duration: 5.4
            }, 0)
            .to(qsa(".backdrop-axis", backdrop), {
                x: -30,
                y: -24,
                rotation: 38,
                scale: 1.12,
                duration: 8.2
            }, 0)
            .to(qsa(".backdrop-dots", backdrop), {
                x: -68,
                y: 44,
                scale: 1.18,
                autoAlpha: 0.95,
                duration: 4.8
            }, 0)
            .to(qsa(".backdrop-scan", backdrop), {
                x: "48vw",
                y: -56,
                scaleX: 1.18,
                autoAlpha: 0.92,
                duration: 6.2
            }, 0)
            .to(qsa(".backdrop-node.is-one", backdrop), {
                x: "18vw",
                y: -38,
                scale: 1.35,
                autoAlpha: 0.92,
                duration: 5.2
            }, 0.15)
            .to(qsa(".backdrop-node.is-two", backdrop), {
                x: "-16vw",
                y: 46,
                scale: 1.4,
                autoAlpha: 0.86,
                duration: 5.8
            }, 0)
            .to(shapes, {
                y: (index) => (index % 2 ? -18 : 18),
                duration: 5.8,
                stagger: { each: 0.16, from: "center" }
            }, 0.2);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                ambient.pause();
            } else {
                ambient.play();
            }
        });
    }

    function initAnimations(scope = document) {
        if (!hasGSAP || prefersReducedMotion) return;
        gsap.defaults({ ease: "power3.out", overwrite: "auto" });

        const heroChars = qsa(".hero .split-char, .page-title .split-char", scope);
        if (heroChars.length && !scope.__heroAnimated) {
            scope.__heroAnimated = true;
            const heroScope = qs(".hero, .page-header, .article-hero", scope) || document;
            const heroOrnaments = qsa(".ornament", heroScope);
            const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
            intro
                .from(".site-header", {
                    y: -18,
                    autoAlpha: 0,
                    duration: 0.55
                })
                .from(heroOrnaments, {
                    x: (index) => (index % 2 ? 32 : -28),
                    y: (index) => (index % 3 ? 18 : -18),
                    rotation: (index) => (index % 2 ? 18 : -16),
                    scale: 0.78,
                    autoAlpha: 0,
                    duration: 0.95,
                    stagger: { each: 0.045, from: "edges" }
                }, "-=0.2")
                .from(heroChars, {
                    yPercent: 104,
                    scaleY: 0.72,
                    autoAlpha: 0,
                    duration: 0.92,
                    ease: "power4.out",
                    stagger: { each: 0.018, from: "start" }
                }, "-=0.18")
                .from(".eyebrow, .hero-lead, .hero-note, .page-subtitle", {
                    y: 22,
                    autoAlpha: 0,
                    duration: 0.56,
                    stagger: 0.06
                }, "-=0.36")
                .from(".hero-footer", {
                    scaleX: 0,
                    autoAlpha: 0,
                    transformOrigin: "left center",
                    duration: 0.55
                }, "-=0.28");

            const axis = qsa(".hero .ornament-axis, .page-header .ornament-axis, .article-hero .ornament-axis", scope);
            if (axis.length) {
                intro.to(axis, {
                    rotation: "+=12",
                    scale: 1.04,
                    duration: 0.8,
                    yoyo: true,
                    repeat: 1,
                    ease: "sine.inOut"
                }, "-=0.3");
            }
        }

        function revealElement(element) {
            if (element.dataset.revealReady === "true") return;
            element.dataset.revealReady = "true";

            const isCard = element.matches(".content-card, .work-card, .article-card, .next-card");
            const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
            timeline.from(element, {
                y: isCard ? 34 : 38,
                scale: isCard ? 0.975 : 1,
                scaleY: isCard ? 1 : 0.96,
                autoAlpha: 0,
                duration: isCard ? 0.62 : 0.72,
                transformOrigin: "top center",
            });

            const details = qsa(".chip, .tag, .work-tag, h2, h3, p, .text-link, .side-link, .article-meta, strong, span", element);
            if (details.length) {
                timeline.from(details.slice(0, 8), {
                    y: 12,
                    autoAlpha: 0,
                    duration: 0.42,
                    stagger: 0.035
                }, "-=0.42");
            }
        }

        const revealTargets = qsa([
            "[data-reveal]",
            ".section-heading",
            ".content-card",
            ".work-card",
            ".article-card",
            ".next-card",
            ".listing-side",
            ".article-side",
            ".article-body",
            ".article-footer"
        ].join(","), scope);
        if (!("IntersectionObserver" in window)) {
            revealTargets.forEach(revealElement);
        } else {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    revealElement(entry.target);
                    observer.unobserve(entry.target);
                });
            }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });

            revealTargets.forEach((element) => {
                if (element.dataset.revealReady === "true") return;
                observer.observe(element);
            });
        }

        initHoverMotion(scope);
        initAmbientMotion(scope);
    }

    function initHoverMotion(scope = document) {
        qsa(".content-card, .work-card, .article-card, .next-card, .stat, .text-link, .side-link, .open-post", scope).forEach((element) => {
            if (element.dataset.motionBound === "true") return;
            element.dataset.motionBound = "true";

            const innerTargets = qsa("h2, h3, strong, p, .chip, .tag, .work-tag, .text-link", element);
            element.addEventListener("mouseenter", () => {
                gsap.to(element, {
                    y: -6,
                    duration: 0.32,
                    ease: "power2.out"
                });
                if (innerTargets.length) {
                    gsap.to(innerTargets, {
                        x: 3,
                        duration: 0.34,
                        stagger: 0.012,
                        ease: "power2.out"
                    });
                }
            });

            element.addEventListener("mouseleave", () => {
                gsap.to(element, {
                    y: 0,
                    duration: 0.36,
                    ease: "power2.out",
                    clearProps: "transform"
                });
                if (innerTargets.length) {
                    gsap.to(innerTargets, {
                        x: 0,
                        duration: 0.3,
                        stagger: 0.01,
                        ease: "power2.out",
                        clearProps: "transform"
                    });
                }
            });
        });
    }

    function initAmbientMotion(scope = document) {
        qsa(".hero, .page-header, .article-hero", scope).forEach((host) => {
            if (host.dataset.ambientReady === "true") return;
            const ornaments = qsa(".ornament", host);
            if (!ornaments.length) return;
            host.dataset.ambientReady = "true";

            const ambient = gsap.timeline({
                paused: true,
                repeat: -1,
                yoyo: true,
                defaults: { ease: "sine.inOut" }
            });
            let hasMotion = false;

            function add(targets, vars, position = 0) {
                if (!targets.length) return;
                hasMotion = true;
                ambient.to(targets, vars, position);
            }

            add(qsa(".ornament-ring, .ornament-crescent", host), {
                rotation: (index) => (index % 2 ? -10 : 10),
                scale: 1.035,
                duration: 7.8,
                stagger: 0.35
            });
            add(qsa(".ornament-frame, .ornament-capsule", host), {
                x: (index) => (index % 2 ? 16 : -14),
                y: (index) => (index % 2 ? -8 : 8),
                rotation: "+=4",
                duration: 8.4,
                stagger: 0.3
            });
            add(qsa(".ornament-line", host), {
                x: 14,
                scaleX: 1.22,
                duration: 5.6
            });
            add(qsa(".ornament-dots", host), {
                x: 18,
                autoAlpha: 0.72,
                duration: 4.8
            });
            add(qsa(".ornament-axis, .ornament-tick", host), {
                rotation: "+=12",
                scale: 1.04,
                duration: 9.2
            });

            if (!hasMotion) return;

            if (!("IntersectionObserver" in window)) {
                ambient.delay(0.9).play();
                return;
            }

            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        ambient.play();
                    } else {
                        ambient.pause();
                    }
                });
            }, { threshold: 0.08 });

            ambient.delay(0.9);
            observer.observe(host);
        });
    }

    function initScopedOrnaments() {
        const hosts = qsa(".hero, .page-header, .article-hero, .section, .listing-layout, .article-layout");
        const newOrnaments = [];

        function ornamentMarkup(host) {
            if (host.matches(".section")) {
                return `
                    <span class="ornament ornament-grid"></span>
                    <span class="ornament ornament-crescent"></span>
                    <span class="ornament ornament-line"></span>
                `;
            }

            if (host.matches(".listing-layout, .article-layout")) {
                return `
                    <span class="ornament ornament-grid"></span>
                    <span class="ornament ornament-capsule"></span>
                    <span class="ornament ornament-tick"></span>
                `;
            }

            return `
                <span class="ornament ornament-ring"></span>
                <span class="ornament ornament-frame"></span>
                <span class="ornament ornament-line"></span>
                <span class="ornament ornament-dots"></span>
                <span class="ornament ornament-capsule"></span>
                <span class="ornament ornament-axis"></span>
                <span class="ornament ornament-crescent"></span>
            `;
        }

        hosts.forEach((host) => {
            if (host.dataset.ornamentsReady === "true") return;
            host.dataset.ornamentsReady = "true";

            const layer = document.createElement("div");
            layer.className = "ornament-layer";
            layer.setAttribute("aria-hidden", "true");
            layer.innerHTML = ornamentMarkup(host);
            host.prepend(layer);
            newOrnaments.push(...qsa(".ornament", layer));
        });

        if (!hasGSAP || prefersReducedMotion || !newOrnaments.length) return;

        gsap.from(newOrnaments.filter((item) => item.classList.contains("ornament-ring")), {
            scale: 0.72,
            autoAlpha: 0,
            duration: 0.8,
            stagger: 0.05
        });
        gsap.from(newOrnaments.filter((item) => item.classList.contains("ornament-frame")), {
            x: 36,
            autoAlpha: 0,
            duration: 0.85,
            stagger: 0.05
        });
        gsap.from(newOrnaments.filter((item) => item.classList.contains("ornament-line")), {
            scaleX: 0,
            autoAlpha: 0,
            transformOrigin: "left center",
            duration: 0.65,
            stagger: 0.05
        });
        gsap.from(newOrnaments.filter((item) => item.classList.contains("ornament-dots")), {
            y: -12,
            autoAlpha: 0,
            duration: 0.55,
            stagger: 0.05
        });
        gsap.from(newOrnaments.filter((item) => item.classList.contains("ornament-capsule")), {
            x: 24,
            scaleX: 0.82,
            autoAlpha: 0,
            duration: 0.76,
            stagger: 0.04
        });
        gsap.from(newOrnaments.filter((item) => item.classList.contains("ornament-axis") || item.classList.contains("ornament-tick")), {
            rotation: -18,
            scale: 0.84,
            autoAlpha: 0,
            duration: 0.72,
            stagger: 0.04
        });
        gsap.from(newOrnaments.filter((item) => item.classList.contains("ornament-crescent") || item.classList.contains("ornament-grid")), {
            y: 18,
            autoAlpha: 0,
            duration: 0.72,
            stagger: 0.04
        });
    }

    function initMusic() {
        const button = qs("[data-music-toggle]");
        const audio = qs("#bg-music");
        if (!button || !audio) return;

        function sync() {
            button.classList.toggle("playing", !audio.paused);
            button.setAttribute("aria-label", audio.paused ? "播放背景音乐" : "暂停背景音乐");
        }

        button.addEventListener("click", () => {
            if (audio.paused) {
                audio.play().catch(() => {});
            } else {
                audio.pause();
            }
            sync();
        });

        audio.addEventListener("play", sync);
        audio.addEventListener("pause", sync);
        sync();
    }

    function postCard(post) {
        return `
            <a class="article-card" href="article.html?post=${encodeURIComponent(post.id)}" data-reveal>
                <div class="article-meta">
                    <time datetime="${escapeHTML(post.date)}">${escapeHTML(post.date)}</time>
                    <span class="tag">#${escapeHTML(post.tag)}</span>
                </div>
                <div>
                    <h2>${escapeHTML(post.title)}</h2>
                    <p>${escapeHTML(post.excerpt || "")}</p>
                </div>
            </a>
        `;
    }

    function workCard(work) {
        const tags = (work.tags || []).map((tag) => `<span class="work-tag">#${escapeHTML(tag)}</span>`).join("");
        return `
            <button class="work-card" type="button" data-work="${escapeHTML(work.id)}" data-reveal>
                <div class="card-top">
                    <span class="work-code">${escapeHTML(work.code || "")}</span>
                </div>
                <div>
                    <h2>${escapeHTML(work.title)}</h2>
                    <p>${escapeHTML(work.description || "")}</p>
                </div>
                <div class="work-tags">${tags}</div>
            </button>
        `;
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

    async function renderHome() {
        const postTarget = qs("[data-home-posts]");
        const workTarget = qs("[data-home-works]");
        const countTargets = qsa("[data-count]");

        const [posts, works] = await Promise.all([loadPosts(), loadWorks()]);

        countTargets.forEach((node) => {
            const type = node.dataset.count;
            node.textContent = String(type === "posts" ? posts.length : works.length).padStart(2, "0");
        });

        if (postTarget) {
            postTarget.innerHTML = posts.slice(0, 3).map((post) => `
                <a class="content-card" href="article.html?post=${encodeURIComponent(post.id)}" data-reveal>
                    <div class="card-top">
                        <time class="chip" datetime="${escapeHTML(post.date)}">${escapeHTML(post.date)}</time>
                        <span class="chip">#${escapeHTML(post.tag)}</span>
                    </div>
                    <div>
                        <h3>${escapeHTML(post.title)}</h3>
                        <p>${escapeHTML(post.excerpt || "")}</p>
                    </div>
                    <span class="text-link">Read</span>
                </a>
            `).join("");
        }

        if (workTarget) {
            workTarget.innerHTML = works.slice(0, 2).map((work) => `
                <a class="content-card" href="work.html#${escapeHTML(work.id)}" data-reveal>
                    <div class="card-top">
                        <span class="chip">${escapeHTML(work.code || "")}</span>
                    </div>
                    <div>
                        <h3>${escapeHTML(work.title)}</h3>
                        <p>${escapeHTML(work.description || "")}</p>
                    </div>
                    <span class="text-link">View Work</span>
                </a>
            `).join("");
        }

        splitText();
        initAnimations();
    }

    async function renderBlog() {
        const target = qs("[data-blog-list]");
        const count = qs("[data-blog-count]");
        if (!target) return;

        const posts = await loadPosts();
        if (count) count.textContent = String(posts.length).padStart(2, "0") + " 篇文章";
        target.innerHTML = posts.map(postCard).join("");
        splitText();
        if (page !== "blog") initAnimations();
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

    function openModalShell() {
        const overlay = qs("[data-modal-overlay]");
        if (!overlay) return;
        modalScrollY = window.scrollY;
        overlay.classList.add("active");
        document.body.style.position = "fixed";
        document.body.style.top = "-" + modalScrollY + "px";
        document.body.style.width = "100%";

        if (hasGSAP && !prefersReducedMotion) {
            gsap.killTweensOf([overlay, "[data-modal-content]"]);
            gsap.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: "power2.out" });
            gsap.fromTo("[data-modal-content]", {
                y: 34,
                autoAlpha: 0,
                scale: 0.98
            }, {
                y: 0,
                autoAlpha: 1,
                scale: 1,
                duration: 0.38,
                ease: "power3.out"
            });
        }
    }

    function closeModal() {
        const overlay = qs("[data-modal-overlay]");
        if (!overlay) return;

        function unlock() {
            overlay.classList.remove("active");
            document.body.style.position = "";
            document.body.style.top = "";
            document.body.style.width = "";
            window.scrollTo(0, modalScrollY);
        }

        if (hasGSAP && !prefersReducedMotion && overlay.classList.contains("active")) {
            gsap.killTweensOf([overlay, "[data-modal-content]"]);
            gsap.timeline({ onComplete: unlock })
                .to("[data-modal-content]", {
                    y: 18,
                    autoAlpha: 0,
                    scale: 0.985,
                    duration: 0.22,
                    ease: "power2.in"
                })
                .to(overlay, {
                    autoAlpha: 0,
                    duration: 0.18,
                    ease: "power2.out"
                }, "-=0.08");
            return;
        }

        unlock();
    }

    async function openWorkModal(workId) {
        const title = qs("[data-modal-title]");
        const meta = qs("[data-modal-meta]");
        const body = qs("[data-modal-body]");
        if (!title || !meta || !body) return;

        title.textContent = "加载中";
        meta.textContent = "";
        body.innerHTML = "<p>内容加载中...</p>";
        openModalShell();

        const work = await loadWork(workId);
        if (!work) {
            title.textContent = "作品不存在";
            body.innerHTML = "<p>没有找到这个作品，请刷新后重试。</p>";
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
        if (count) count.textContent = String(works.length).padStart(2, "0") + " 个项目";
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

        const hash = window.location.hash.replace("#", "");
        if (hash && works.some((work) => work.id === hash)) {
            setTimeout(() => {
                const card = qs(`[data-work="${escapeSelectorValue(hash)}"]`);
                if (card) card.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
            }, 80);
        }

        splitText();
        initAnimations();
    }

    function navCard(post, label) {
        if (!post) return "<span></span>";
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
                <section class="article-hero">
                    <div class="article-meta"><span class="tag">404</span></div>
                    <h1 class="article-title">文章不存在</h1>
                    <p class="article-excerpt">这个文章 ID 没有出现在博客索引里，回到博客列表重新选择一篇吧。</p>
                    <a class="side-link" href="blog.html">返回博客</a>
                </section>
            `;
            return;
        }

        const markdown = await fetchText("blog/" + post.file);
        const parsed = parseFrontmatter(markdown);
        const article = { ...post, ...parsed };
        const htmlContent = window.marked ? marked.parse(article.content || "") : "<pre>" + escapeHTML(article.content || "") + "</pre>";

        document.title = article.title + " - Amorend";
        articleRoot.innerHTML = `
            <section class="article-hero">
                <div class="article-meta">
                    <time datetime="${escapeHTML(article.date)}">${escapeHTML(article.date)}</time>
                    <span class="tag">#${escapeHTML(article.tag)}</span>
                </div>
                <h1 class="article-title" data-reveal>${escapeHTML(article.title)}</h1>
                <p class="article-excerpt" data-reveal>${escapeHTML(article.excerpt || "")}</p>
            </section>

            <div class="article-layout">
                <aside class="article-side">
                    <a class="side-link" href="blog.html">返回博客</a>
                    <span>Reading / ${String(index + 1).padStart(2, "0")}</span>
                </aside>
                <article>
                    <div class="article-body" data-reveal>${htmlContent}</div>
                    <nav class="article-footer" aria-label="相邻文章">
                        ${navCard(posts[index + 1], "Previous Signal")}
                        ${navCard(posts[index - 1], "Next Signal")}
                    </nav>
                </article>
            </div>
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
        splitText();

        if (page === "home") await renderHome();
        if (page === "blog") await renderBlog();
        if (page === "work") await renderWorks();
        if (page === "article") await renderArticle();

    }

    initTheme();
    initMenu();
    initMusic();
    initPage().catch(renderError);
})();
