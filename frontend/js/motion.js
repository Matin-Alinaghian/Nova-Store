const Motion = (() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const rafPool = new Set();
    function raf(id, fn) {
        if (rafPool.has(id)) return;
        rafPool.add(id);
        requestAnimationFrame(() => {
            rafPool.delete(id);
            fn();
        });
    }
    function initBootLoader() {
        const loader = document.querySelector('.boot-loader');
        if (!loader) return;
        if (prefersReduced) {
            loader.classList.add('done');
            return;
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => loader.classList.add('done'));
        });
        setTimeout(() => loader.classList.add('done'), 2500);
    }
    let observer = null;
    function initReveal() {
        if (prefersReduced || !('IntersectionObserver' in window)) {
            document.querySelectorAll('.reveal, .stagger').forEach(el => el.classList.add('revealed'));
            return;
        }
        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        document.querySelectorAll('.reveal:not(.revealed), .stagger:not(.revealed)').forEach(el => observer.observe(el));
    }
    function rescan() {
        if (!observer) { initReveal(); return; }
        document.querySelectorAll('.reveal:not(.revealed), .stagger:not(.revealed)').forEach(el => observer.observe(el));
    }
    function initNavbar() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                navbar.classList.toggle('scrolled', window.scrollY > 40);
                ticking = false;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }
    function initParallax() {
        if (prefersReduced || !isDesktop) return;
        const layers = document.querySelectorAll('[data-parallax]');
        if (!layers.length) return;
        let mx = 0, my = 0, cx = 0, cy = 0, running = false;
        const tick = () => {
            cx += (mx - cx) * 0.06;
            cy += (my - cy) * 0.06;
            layers.forEach(layer => {
                const s = parseFloat(layer.dataset.parallax) || 20;
                layer.style.transform = `translate3d(${(-cx * s).toFixed(2)}px, ${(-cy * s).toFixed(2)}px, 0)`;
            });
            if (Math.abs(mx - cx) > 0.001 || Math.abs(my - cy) > 0.001) {
                requestAnimationFrame(tick);
            } else {
                running = false;
            }
        };
        window.addEventListener('mousemove', (e) => {
            mx = (e.clientX / window.innerWidth) * 2 - 1;
            my = (e.clientY / window.innerHeight) * 2 - 1;
            if (!running) { running = true; requestAnimationFrame(tick); }
        }, { passive: true });
    }
    function attachTilt(card) {
        if (!isDesktop || prefersReduced || card.dataset.tiltBound) return;
        card.dataset.tiltBound = '1';
        const strength = 5;
        let rect = null;
        card.addEventListener('mouseenter', () => { rect = card.getBoundingClientRect(); });
        card.addEventListener('mousemove', (e) => {
            if (!rect) rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            raf(card, () => {
                card.style.transform = `perspective(900px) rotateX(${(-y * strength).toFixed(2)}deg) rotateY(${(x * strength).toFixed(2)}deg) translateY(-8px)`;
            });
        });
        card.addEventListener('mouseleave', () => {
            rect = null;
            card.style.transform = '';
        });
    }
    function initTilt(scope = document) {
        if (!isDesktop || prefersReduced) return;
        scope.querySelectorAll('.product-card').forEach(attachTilt);
    }
    function flyToCart(fromEl, toEl) {
        if (prefersReduced || !fromEl || !toEl) return;
        const from = fromEl.getBoundingClientRect();
        const to = toEl.getBoundingClientRect();
        const img = fromEl.querySelector('img');
        const ghost = document.createElement(img ? 'img' : 'div');
        if (img) {
            ghost.src = img.currentSrc || img.src;
            ghost.alt = '';
        }
        ghost.className = 'fly-ghost';
        ghost.style.left = `${from.left + from.width / 2 - 28}px`;
        ghost.style.top = `${from.top + from.height / 2 - 28}px`;
        document.body.appendChild(ghost);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ghost.style.left = `${to.left + to.width / 2 - 14}px`;
                ghost.style.top = `${to.top + to.height / 2 - 14}px`;
                ghost.style.width = '28px';
                ghost.style.height = '28px';
                ghost.style.opacity = '0.25';
                ghost.style.borderRadius = '50%';
            });
        });
        setTimeout(() => ghost.remove(), 800);
        const badge = toEl.querySelector('.badge-count');
        if (badge) {
            badge.classList.remove('bump');
            void badge.offsetWidth;
            badge.classList.add('bump');
        }
    }
    function initHeroParticles() {
        const canvas = document.getElementById('hero-particles');
        if (!canvas || prefersReduced) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const COUNT = isMobile ? 18 : 42;
        let w = 0, h = 0, running = true;
        const resize = () => {
            const rect = canvas.parentElement.getBoundingClientRect();
            w = canvas.width = rect.width;
            h = canvas.height = rect.height;
        };
        resize();
        window.addEventListener('resize', resize, { passive: true });
        const parts = Array.from({ length: COUNT }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 1.8 + 0.6,
            vy: -(Math.random() * 0.35 + 0.12),
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.015 + 0.005,
            alpha: Math.random() * 0.5 + 0.25,
            hue: Math.random() > 0.5 ? '59, 130, 246' : '34, 211, 238'
        }));
        document.addEventListener('visibilitychange', () => { running = !document.hidden; });
        const draw = () => {
            if (!running) { requestAnimationFrame(draw); return; }
            ctx.clearRect(0, 0, w, h);
            for (const p of parts) {
                p.y += p.vy;
                p.sway += p.swaySpeed;
                p.x += Math.sin(p.sway) * 0.18;
                if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.hue}, ${p.alpha})`;
                ctx.shadowColor = `rgba(${p.hue}, 0.8)`;
                ctx.shadowBlur = 6;
                ctx.fill();
            }
            ctx.shadowBlur = 0;
            requestAnimationFrame(draw);
        };
        draw();
    }
    function initBackTop() {
        if (document.querySelector('.back-top')) return;
        const btn = document.createElement('button');
        btn.className = 'back-top';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'بازگشت به بالا');
        btn.title = 'بازگشت به بالا';
        btn.textContent = '↑';
        document.body.appendChild(btn);
        let ticking = false;
        const sync = () => {
            btn.classList.toggle('show', window.scrollY > 480);
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(sync);
        }, { passive: true });
        sync();
        btn.addEventListener('click', () => {
            if (window.soundManager) window.soundManager.play('click');
            window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
        });
    }
    return { initBootLoader, initReveal, rescan, initNavbar, initParallax, initTilt, attachTilt, flyToCart, initHeroParticles, initBackTop, prefersReduced, isDesktop };
})();
document.addEventListener('DOMContentLoaded', () => {
    Motion.initBootLoader();
    Motion.initReveal();
    Motion.initNavbar();
    Motion.initParallax();
    Motion.initTilt();
    Motion.initHeroParticles();
    Motion.initBackTop();
});
