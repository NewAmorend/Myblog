/* =========================================================================
   AMOREND — atmosphere
   Windstorm dust (canvas), film-grain life, scroll-reveal.
   All animation honors prefers-reduced-motion.
   ========================================================================= */
(function () {
    "use strict";

    var root = document.documentElement;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var isCoarse = window.matchMedia("(pointer: coarse)").matches;

    /* ---------- dust / windstorm canvas ---------- */
    function initDust() {
        var canvas = document.querySelector(".atmo-dust");
        if (!canvas || reduce) return;
        var ctx = canvas.getContext("2d");
        if (!ctx) return;

        var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
        var particles = [];
        var TARGET = isCoarse ? 46 : 92;

        function resize() {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function spawn(initial) {
            return {
                x: initial ? Math.random() * w : w + Math.random() * 120,
                y: Math.random() * h,
                len: 6 + Math.random() * 34,
                vx: -(0.25 + Math.random() * 1.15),
                amp: 4 + Math.random() * 22,
                freq: 0.002 + Math.random() * 0.006,
                phase: Math.random() * Math.PI * 2,
                a: 0.04 + Math.random() * 0.22
            };
        }

        function seed() {
            particles = [];
            for (var i = 0; i < TARGET; i++) particles.push(spawn(true));
        }

        var t = 0, running = true;

        function draw() {
            if (!running) return;
            t += 1;
            ctx.clearRect(0, 0, w, h);
            ctx.lineWidth = 1;

            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                p.x += p.vx;
                var y = p.y + Math.sin(t * p.freq + p.phase) * p.amp;

                if (p.x < -p.len) {
                    particles[i] = spawn(false);
                    continue;
                }

                var g = ctx.createLinearGradient(p.x, y, p.x + p.len, y);
                g.addColorStop(0, "rgba(232,227,215,0)");
                g.addColorStop(0.5, "rgba(232,227,215," + p.a + ")");
                g.addColorStop(1, "rgba(232,227,215,0)");
                ctx.strokeStyle = g;
                ctx.beginPath();
                ctx.moveTo(p.x, y);
                ctx.lineTo(p.x + p.len, y);
                ctx.stroke();
            }

            raf = requestAnimationFrame(draw);
        }

        var raf = 0;
        function start() { if (!running) { running = true; raf = requestAnimationFrame(draw); } }
        function stop()  { running = false; if (raf) cancelAnimationFrame(raf); }

        resize();
        seed();
        raf = requestAnimationFrame(draw);

        var rt;
        window.addEventListener("resize", function () {
            clearTimeout(rt);
            rt = setTimeout(function () { resize(); seed(); }, 180);
        }, { passive: true });

        document.addEventListener("visibilitychange", function () {
            if (document.hidden) stop(); else start();
        });
    }

    /* ---------- scroll reveal ---------- */
    function initReveal() {
        var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
        if (!nodes.length || reduce || !("IntersectionObserver" in window)) {
            nodes.forEach(function (n) { n.classList.add("is-in"); });
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add("is-in");
                    io.unobserve(e.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

        nodes.forEach(function (n) { io.observe(n); });

        /* pick up dynamically injected cards (site.js builds them async) */
        if ("MutationObserver" in window) {
            var sel = ".post-item, .work-item, .next-card";
            var mo = new MutationObserver(function (muts) {
                for (var i = 0; i < muts.length; i++) {
                    var added = muts[i].addedNodes;
                    for (var j = 0; j < added.length; j++) {
                        var node = added[j];
                        if (node.nodeType !== 1) continue;
                        var hits = node.matches && node.matches(sel)
                            ? [node]
                            : Array.prototype.slice.call(node.querySelectorAll ? node.querySelectorAll(sel) : []);
                        hits.forEach(function (el) {
                            el.setAttribute("data-reveal", "");
                            io.observe(el);
                        });
                    }
                }
            });
            mo.observe(document.body, { childList: true, subtree: true });
        }
    }

    /* ---------- re-trigger hero entrance on page show (bfcache) ---------- */
    function initHero() {
        var hero = document.querySelector(".hero-enter");
        if (hero && reduce) return;
    }

    function boot() {
        initDust();
        initReveal();
        initHero();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
