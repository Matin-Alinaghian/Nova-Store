class Store {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
        this.products = [];
        this.searchQuery = '';
        this.selectedCategory = 'all';
        this.sortMode = 'featured';
        this.wishlistOnly = new URLSearchParams(window.location.search).get('wishlist') === '1';
        this.user = {
            id: localStorage.getItem('user_id'),
            username: localStorage.getItem('username'),
            is_admin: ['true', '1', 'yes'].includes((localStorage.getItem('is_admin') || '').toLowerCase())
        };
        this.init();
    }
    init() {
        this.updateNavBar();
        this.loadProducts();
        this.setupEventListeners();
        this.buildChrome();
        this.bindNavSoundsAndTheme();
        this.renderWishlistBadge();
    }
    buildChrome() {
        if (!document.getElementById('cart-drawer')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="menu-overlay" id="menu-overlay"></div>
                <aside class="mobile-menu" id="mobile-menu" aria-label="منوی موبایل">
                    <div class="mobile-menu-head">
                        <span class="brand-name"><b>NOVA</b> STORE</span>
                        <button class="icon-btn" id="mm-close" aria-label="بستن منو">✕</button>
                    </div>
                    <nav>
                        <a href="/" class="mnav-link">🏠 صفحه اصلی</a>
                        <a href="/products" class="mnav-link">🛍️ محصولات</a>
                        <a href="/cart" class="mnav-link">🛒 سبد خرید</a>
                        <a href="/orders" class="mnav-link">📦 سفارش‌های من</a>
                        <a href="/about" class="mnav-link">💠 درباره ما</a>
                        <a href="/login" class="mnav-link" data-auth="login">ورود / ثبت‌نام</a>
                        <a href="/admin" class="mnav-link" data-auth="admin" style="display:none">⚙️ پنل مدیریت</a>
                    </nav>
                    <div class="mobile-menu-foot">
                        <button class="btn btn-ghost btn-block" id="mm-logout" style="display:none">خروج از حساب</button>
                    </div>
                </aside>
                <div class="cart-drawer" id="cart-drawer" aria-label="سبد خرید">
                    <div class="cart-drawer-head">
                        <h2>🛒 سبد خرید</h2>
                        <button class="icon-btn" id="cart-close" aria-label="بستن سبد">✕</button>
                    </div>
                    <div class="cart-drawer-items" id="cart-drawer-items"></div>
                    <div class="cart-drawer-foot">
                        <div class="cart-drawer-total">
                            <span>مجموع:</span>
                            <span class="amount" id="cart-drawer-total">0 تومان</span>
                        </div>
                        <button class="btn btn-primary btn-block" id="cart-drawer-checkout">تکمیل خرید</button>
                    </div>
                </div>
                <div class="modal" id="quickview-modal">
                    <div class="modal-content" id="quickview-content"></div>
                </div>
            `);
        }
        const hamburger = document.getElementById('hamburger');
        const mobileMenu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('menu-overlay');
        const closeMenu = () => { mobileMenu.classList.remove('open'); overlay.classList.remove('show'); };
        if (hamburger) {
            hamburger.addEventListener('click', () => {
                mobileMenu.classList.add('open');
                overlay.classList.add('show');
            });
        }
        if (overlay) overlay.addEventListener('click', closeMenu);
        const mmClose = document.getElementById('mm-close');
        if (mmClose) mmClose.addEventListener('click', closeMenu);
        if (this.user.id) {
            document.querySelectorAll('[data-auth="login"]').forEach(el => el.style.display = 'none');
        } else {
            document.querySelectorAll('[data-auth="admin"]').forEach(el => el.style.display = 'none');
            const mmLogout = document.getElementById('mm-logout');
            if (mmLogout) mmLogout.style.display = 'none';
        }
        if (this.user.is_admin) {
            document.querySelectorAll('[data-auth="admin"]').forEach(el => el.style.display = 'flex');
        }
        const mmLogout = document.getElementById('mm-logout');
        if (mmLogout && this.user.id) {
            mmLogout.style.display = 'block';
            mmLogout.addEventListener('click', () => this.logout());
        }
        const drawer = document.getElementById('cart-drawer');
        const cartClose = document.getElementById('cart-close');
        if (cartClose) cartClose.addEventListener('click', () => this.closeCart());
        const drawerCheckout = document.getElementById('cart-drawer-checkout');
        if (drawerCheckout) {
            drawerCheckout.addEventListener('click', () => {
                const total = this.cart.reduce((s, i) => s + i.price * i.quantity, 0);
                this.checkout(total, () => this.closeCart());
                drawer.classList.remove('open');
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCart();
                closeMenu();
                const qv = document.getElementById('quickview-modal');
                if (qv) qv.classList.remove('open');
            }
        });
    }
    bindNavSoundsAndTheme() {
    }
    updateNavBar() {
        const loginLink = document.getElementById('login-link');
        const logoutBtn = document.getElementById('logout-btn');
        const adminLink = document.getElementById('admin-link');
        const cartCount = document.getElementById('cart-count');
        const wlCount = document.getElementById('wl-count');
        if (this.user.id) {
            if (loginLink) loginLink.style.display = 'none';
            if (logoutBtn) {
                logoutBtn.style.display = 'inline-block';
                logoutBtn.addEventListener('click', () => this.logout());
            }
            if (adminLink && this.user.is_admin) {
                adminLink.style.display = 'inline-block';
                adminLink.href = '/admin';
            }
        }
        if (cartCount) {
            const qty = this.cart.reduce((s, i) => s + i.quantity, 0);
            cartCount.textContent = qty;
        }
        this.renderWishlistBadge();
    }
    async loadProducts() {
        try {
            const products = await api.getProducts();
            this.products = products;
            this.populateCategories();
            this.displayProducts(this.filteredProducts());
            this.displayFeatured();
        } catch (error) {
            console.error('خطا در بارگذاری محصولات:', error);
            const list = document.getElementById('products-list');
            if (list) list.innerHTML = `<div class="loading-block"><span>⚠️ خطا در بارگذاری محصولات — دیتابیس/سرور را بررسی کنید</span></div>`;
        }
    }
    filteredProducts() {
        const query = this.searchQuery.toLowerCase().trim();
        const list = this.products.filter(product => {
            const matchesCategory = this.selectedCategory === 'all' || product.category === this.selectedCategory;
            const matchesWishlist = !this.wishlistOnly || this.wishlist.includes(product.id);
            const searchableText = `${product.name} ${product.description || ''} ${product.category || ''}`.toLowerCase();
            return matchesCategory && matchesWishlist && (!query || searchableText.includes(query));
        });
        const priceOf = p => (p.discount_price && p.discount_price < p.price) ? p.discount_price : p.price;
        if (this.sortMode === 'price-asc') {
            list.sort((a, b) => priceOf(a) - priceOf(b));
        } else if (this.sortMode === 'price-desc') {
            list.sort((a, b) => priceOf(b) - priceOf(a));
        } else if (this.sortMode === 'discount') {
            list.sort((a, b) => (b.discount_percent || 0) - (a.discount_percent || 0));
        } else {
            list.sort((a, b) => (b.featured === true) - (a.featured === true));
        }
        return list;
    }
    displayProducts(products) {
        const listElement = document.getElementById('products-list');
        if (listElement) {
            if (!products.length) {
                listElement.innerHTML = `<div class="loading-block" style="grid-column: 1/-1"><span>🔍 محصولی مطابق جستجو/فیلتر شما پیدا نشد</span></div>`;
            } else {
                listElement.innerHTML = products.map((p, i) => this.productCard(p, i)).join('');
                listElement.classList.add('stagger');
                listElement.classList.remove('revealed');
                Motion.rescan();
                Motion.initTilt(listElement);
            }
            const rc = document.getElementById('result-count');
            if (rc) rc.textContent = `${products.length.toLocaleString('fa-IR')} محصول`;
        }
        if (this.wishlistOnly && !products.length && this.wishlist.length === 0) {
            const rc = document.getElementById('result-count');
            if (rc) rc.textContent = 'هنوز محصولی به علاقه‌مندی‌ها اضافه نکرده‌اید ♥';
        }
    }
    displayFeatured() {
        const featuredElement = document.getElementById('featured-list');
        if (!featuredElement) return;
        const featured = this.products.filter(product => product.featured);
        const visibleCount = window.innerWidth <= 768 ? 1 : 3;
        const carouselItems = featured.length > visibleCount
            ? featured.concat(featured.slice(0, visibleCount))
            : featured;
        featuredElement.innerHTML = carouselItems.map((p, i) => this.productCard(p, i)).join('');
        this.setupFeaturedCarousel(featured.length);
    }
    productCard(product, index = 0) {
        const hasDiscount = product.discount_price && product.discount_price < product.price;
        const displayPrice = hasDiscount ? product.discount_price : product.price;
        const outOfStock = (product.quantity || 0) <= 0;
        const rating = 4 + ((product.id * 7) % 10) / 10;
        const wished = this.wishlist.includes(product.id);
        const priceMarkup = hasDiscount
            ? `<span class="old-price-row"><span class="original-price">${product.price.toLocaleString('fa-IR')} تومان</span><span class="discount-badge">${product.discount_percent || Math.round((1 - product.discount_price / product.price) * 100)}٪</span></span>
               <span class="current-price-row"><span class="discount-price">${displayPrice.toLocaleString('fa-IR')}</span><span class="currency">تومان</span></span>`
            : `<span class="current-price-row"><span class="discount-price">${displayPrice.toLocaleString('fa-IR')}</span><span class="currency">تومان</span></span>`;
        const desc = (product.description || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
            <article class="product-card" data-id="${product.id}" data-idx="${index}" onclick="store.openProduct(${product.id})">
                <div class="product-image">
                    <img src="${product.image_url || 'https://via.placeholder.com/400x300'}" alt="${product.name}" loading="lazy" decoding="async" onclick="event.stopPropagation(); store.openProduct(${product.id})">
                    <div class="product-badges">
                        ${hasDiscount ? `<span class="badge badge-discount">٪${product.discount_percent || Math.round((1 - product.discount_price / product.price) * 100)} تخفیف</span>` : ''}
                        ${product.featured ? `<span class="badge badge-featured">⭐ ویژه</span>` : ''}
                        ${outOfStock ? `<span class="badge badge-out">ناموجود</span>` : ''}
                    </div>
                    <div class="product-actions">
                        <button class="product-action-btn wl-btn ${wished ? 'wished' : ''}" title="علاقه‌مندی" aria-label="افزودن به علاقه‌مندی" onclick="event.stopPropagation(); store.toggleWishlist(${product.id}, this)">${wished ? '♥' : '♡'}</button>
                        <button class="product-action-btn" title="مشاهده سریع" aria-label="مشاهده سریع" onclick="event.stopPropagation(); store.quickView(${product.id})">👁</button>
                    </div>
                </div>
                <div class="product-info">
                    <span class="p-category">${product.category || 'عمومی'}</span>
                    <h3>${product.name}</h3>
                    <p class="p-desc">${product.description || ''}</p>
                    <div class="product-rating">★★★★<span>★</span> <span class="rating-count">(${rating.toFixed(1)})</span></div>
                    <div class="product-footer">
                        <span class="price price-display">${priceMarkup}</span>
                        <button class="btn btn-primary btn-small" ${outOfStock ? 'disabled' : ''} onclick="event.stopPropagation(); store.addToCart(${product.id}, '${(product.name || '').replace(/'/g, "\\'")}', ${displayPrice}, '${product.image_url || ''}', '${desc}')">🛒 افزودن</button>
                    </div>
                </div>
            </article>`;
    }
    setupFeaturedCarousel(count) {
        const track = document.getElementById('featured-list');
        const previous = document.getElementById('featured-prev');
        const next = document.getElementById('featured-next');
        if (!track) return;
        if (this.featuredTimer) clearInterval(this.featuredTimer);
        this.featuredIndex = 0;
        const visibleCount = window.innerWidth <= 768 ? 1 : 3;
        const maxIndex = count;
        const hasCarousel = count > visibleCount;
        const update = () => {
            const gap = window.innerWidth <= 768 ? 16 : 40;
            const slideWidth = (track.parentElement.clientWidth + gap) / visibleCount;
            track.style.transform = `translateX(${this.featuredIndex * slideWidth}px)`;
        };        const move = direction => {
            if (!hasCarousel) return;
            this.featuredIndex += direction;
            if (this.featuredIndex < 0) this.featuredIndex = maxIndex - 1;
            update();
            if (this.featuredIndex === maxIndex) {
                clearTimeout(this.featuredResetTimer);
                this.featuredResetTimer = setTimeout(() => {
                    track.style.transition = 'none';
                    this.featuredIndex = 0;
                    update();
                    requestAnimationFrame(() => {
                        track.style.transition = 'transform 0.7s ease';
                    });
                }, 750);
            }
        };
        if (previous) previous.onclick = () => move(-1);
        if (next) next.onclick = () => move(1);
        if (previous) previous.style.display = hasCarousel ? 'block' : 'none';
        if (next) next.style.display = hasCarousel ? 'block' : 'none';
        if (hasCarousel) this.featuredTimer = setInterval(() => move(1), 5000);
        update();
    }
    populateCategories() {
        const categoryFilter = document.getElementById('category-filter');
        if (!categoryFilter) return;
        const categories = [...new Set(this.products.map(product => product.category).filter(Boolean))].sort();
        const current = this.selectedCategory;
        categoryFilter.innerHTML = '<option value="all">همه محصولات</option>' +
            categories.map(category => `<option value="${category}">${category}</option>`).join('');
        categoryFilter.value = current;
        const chipRow = document.getElementById('category-chips');
        if (chipRow) {
            chipRow.innerHTML = `<button class="chip ${current === 'all' ? 'active' : ''}" data-cat="all">همه</button>` +
                categories.map(c => `<button class="chip ${current === c ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
        }
    }
    setupEventListeners() {
        const cartLink = document.getElementById('cart-link');
        if (cartLink) {
            cartLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openCart();
            });
        }
        const cartIconBtn = document.getElementById('cart-icon-btn');
        if (cartIconBtn) {
            cartIconBtn.addEventListener('click', (e) => { e.preventDefault(); this.openCart(); });
        }
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.searchQuery = e.target.value;
                    this.displayProducts(this.filteredProducts());
                    this.renderSuggestions(e.target.value);
                }, 220);
            });
            searchInput.addEventListener('focus', () => this.renderSuggestions(searchInput.value));
            searchInput.addEventListener('blur', () => {
                setTimeout(() => this.closeSuggestions(), 180);
            });
        }
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.selectedCategory = e.target.value;
                this.displayProducts(this.filteredProducts());
                this.populateCategories();
            });
        }
        const chipRow = document.getElementById('category-chips');
        if (chipRow) {
            chipRow.addEventListener('click', (e) => {
                const chip = e.target.closest('.chip');
                if (!chip) return;
                this.selectedCategory = chip.dataset.cat;
                this.displayProducts(this.filteredProducts());
                this.populateCategories();
            });
        }
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortMode = e.target.value;
                this.displayProducts(this.filteredProducts());
            });
        }
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-btn')) {
                e.target.closest('.modal').classList.remove('open');
            }
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('open');
            }
        });
    }
    renderSuggestions(query) {
        const box = document.getElementById('search-suggestions');
        if (!box) return;
        const q = (query || '').toLowerCase().trim();
        let items = this.products;
        if (q) {
            items = this.products.filter(p =>
                `${p.name} ${p.description || ''} ${p.category || ''}`.toLowerCase().includes(q)).slice(0, 6);
        } else {
            items = this.products.filter(p => p.featured).slice(0, 5);
            if (!items.length) items = this.products.slice(0, 5);
        }
        if (!items.length) {
            box.classList.remove('show');
            return;
        }
        box.innerHTML = items.map(p => {
            const price = (p.discount_price && p.discount_price < p.price) ? p.discount_price : p.price;
            return `<div class="suggestion-item" data-id="${p.id}">
                <img src="${p.image_url || 'https://via.placeholder.com/80'}" alt="">
                <div><div class="s-name">${p.name}</div><div class="s-price">${price.toLocaleString('fa-IR')} تومان</div></div>
            </div>`;
        }).join('');
        box.classList.add('show');
    }
    closeSuggestions() {
        const box = document.getElementById('search-suggestions');
        if (box) box.classList.remove('show');
    }
    toggleWishlist(productId, btnEl) {
        const idx = this.wishlist.indexOf(productId);
        if (idx >= 0) {
            this.wishlist.splice(idx, 1);
            if (btnEl) btnEl.classList.remove('wished');
            if (btnEl) btnEl.innerHTML = '♡';
        } else {
            this.wishlist.push(productId);
            if (btnEl) {
                btnEl.classList.add('wished');
                btnEl.innerHTML = '♥';
            }
        }
        localStorage.setItem('wishlist', JSON.stringify(this.wishlist));
        this.renderWishlistBadge();
        if (window.soundManager) window.soundManager.play('wish');
        Toast.show(idx >= 0 ? 'از علاقه‌مندی‌ها حذف شد' : 'به علاقه‌مندی‌ها اضافه شد ♥', idx >= 0 ? 'info' : 'success', 2200);
    }
    renderWishlistBadge() {
        const wlCount = document.getElementById('wl-count');
        if (wlCount) {
            wlCount.textContent = this.wishlist.length;
            wlCount.style.display = this.wishlist.length ? 'grid' : 'none';
        }
    }
    addToCart(productId, productName, price, imageUrl = '', description = '') {
        const item = this.cart.find(i => i.product_id === productId);
        const product = this.products.find(p => p.id === productId);
        const maxQty = product ? (product.quantity || 0) : Infinity;
        const currentQty = item ? item.quantity : 0;
        if (maxQty === 0) {
            Toast.show('این محصول ناموجود است', 'error');
            return;
        }
        if (currentQty + 1 > maxQty) {
            Toast.show(`بیشتر از موجودی انبار (${maxQty} عدد) نمی‌توانید بردارید`, 'error');
            return;
        }
        if (item) {
            item.quantity += 1;
        } else {
            this.cart.push({
                product_id: productId,
                name: productName,
                price: price,
                image_url: imageUrl,
                description: description,
                quantity: 1
            });
        }
        this.saveCart();
        this.updateNavBar();
        this.renderCartDrawer();
        if (window.soundManager) window.soundManager.play('add');
        Toast.show('محصول به سبد خرید اضافه شد', 'success', 2400);
        const card = event && event.target ? event.target.closest('.product-card') : null;
        const btn = event && event.target ? event.target.closest('.btn') : null;
        if (btn) {
            btn.classList.add('adding');
            setTimeout(() => btn.classList.remove('adding'), 550);
        }
        const cartTarget = document.getElementById('cart-icon-btn') || document.getElementById('cart-link');
        if (card && cartTarget) Motion.flyToCart(card, cartTarget);
    }
    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
    }
    openCart() {
        this.renderCartDrawer();
        const drawer = document.getElementById('cart-drawer');
        if (drawer) drawer.classList.add('open');
    }
    closeCart() {
        const drawer = document.getElementById('cart-drawer');
        if (drawer) drawer.classList.remove('open');
    }
    renderCartDrawer() {
        const itemsDiv = document.getElementById('cart-drawer-items');
        const totalSpan = document.getElementById('cart-drawer-total');
        if (!itemsDiv || !totalSpan) return;
        if (!this.cart.length) {
            itemsDiv.innerHTML = `<div class="cart-empty"><div class="empty-icon">🛒</div><p>سبد خرید شما خالی است</p><a href="/products" class="btn btn-outline btn-small mt-1">مشاهده محصولات</a></div>`;
            totalSpan.textContent = '0 تومان';
            return;
        }
        itemsDiv.innerHTML = this.cart.map(item => `
            <div class="mini-cart-item" data-pid="${item.product_id}">
                <div class="mini-cart-img">${item.image_url ? `<img src="${item.image_url}" alt="">` : '📦'}</div>
                <div class="mini-cart-info">
                    <h4>${item.name}</h4>
                    <span class="mini-price">${item.price.toLocaleString('fa-IR')} تومان</span>
                    <div class="mini-qty">
                        <button onclick="store.changeQty(${item.product_id}, -1)" aria-label="کاهش">−</button>
                        <span>${item.quantity}</span>
                        <button onclick="store.changeQty(${item.product_id}, 1)" aria-label="افزایش">+</button>
                    </div>
                </div>
                <button class="mini-cart-remove" onclick="store.removeFromCart(${item.product_id})" aria-label="حذف">🗑</button>
            </div>
        `).join('');
        const total = this.cart.reduce((s, i) => s + i.price * i.quantity, 0);
        totalSpan.textContent = `${total.toLocaleString('fa-IR')} تومان`;
    }
    changeQty(productId, delta) {
        const item = this.cart.find(i => i.product_id === productId);
        if (!item) return;
        const product = this.products.find(p => p.id === productId);
        const maxQty = product ? (product.quantity || 0) : Infinity;
        if (delta > 0 && item.quantity >= maxQty) {
            Toast.show(`بیشتر از موجودی انبار (${maxQty} عدد) نمی‌توانید بردارید`, 'error');
            return;
        }
        item.quantity += delta;
        if (item.quantity <= 0) {
            this.removeFromCart(productId);
            return;
        }
        this.saveCart();
        this.updateNavBar();
        this.renderCartDrawer();
    }
    removeFromCart(productId) {
        const el = document.querySelector(`.mini-cart-item[data-pid="${productId}"]`);
        const finish = () => {
            this.cart = this.cart.filter(i => i.product_id !== productId);
            this.saveCart();
            this.updateNavBar();
            this.renderCartDrawer();
        };
        if (el) {
            el.classList.add('removing');
            setTimeout(finish, 320);
        } else {
            finish();
        }
    }
    quickView(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        const modal = document.getElementById('quickview-modal');
        const content = document.getElementById('quickview-content');
        if (!modal || !content) return;
        const hasDiscount = product.discount_price && product.discount_price < product.price;
        const displayPrice = hasDiscount ? product.discount_price : product.price;
        const outOfStock = (product.quantity || 0) <= 0;
        const wished = this.wishlist.includes(product.id);
        const desc = (product.description || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        content.innerHTML = `
            <button class="close-btn" aria-label="بستن">✕</button>
            <div class="qv-grid">
                <div class="qv-stage" id="qv-stage" style="min-height:280px;"></div>
                <div>
                    <span class="p-category" style="font-size:.75rem;font-weight:700;color:var(--accent-2)">${product.category || 'عمومی'}</span>
                    <h2 style="font-size:1.4rem; margin:.3rem 0 .8rem">${product.name}</h2>
                    <div class="product-rating" style="margin-bottom:.6rem">★★★★★ <span class="rating-count">(${(4 + ((product.id * 7) % 10) / 10).toFixed(1)})</span></div>
                    <p style="color:var(--text-secondary); font-size:.9rem; margin-bottom:1rem">${product.description || ''}</p>
                    <div class="price-display" style="margin-bottom:1.2rem">
                        ${hasDiscount ? `<span class="old-price-row"><span class="original-price">${product.price.toLocaleString('fa-IR')} تومان</span><span class="discount-badge">${product.discount_percent || ''}٪</span></span>` : ''}
                        <span class="current-price-row"><span class="discount-price" style="font-size:1.4rem">${displayPrice.toLocaleString('fa-IR')}</span><span class="currency">تومان</span></span>
                    </div>
                    <div style="display:flex; gap:.6rem; flex-wrap:wrap">
                        <button class="btn btn-primary" ${outOfStock ? 'disabled' : ''} onclick="store.addToCart(${product.id}, '${(product.name || '').replace(/'/g, "\\'")}', ${displayPrice}, '${product.image_url || ''}', '${desc}')">🛒 افزودن به سبد</button>
                        <button class="btn btn-ghost" onclick="store.openProduct(${product.id})">جزئیات کامل</button>
                        <button class="icon-btn wl-btn ${wished ? 'wished' : ''}" onclick="store.toggleWishlist(${product.id}, this)">${wished ? '♥' : '♡'}</button>
                    </div>
                </div>
            </div>`;
        modal.classList.add('open');
        const stage = content.querySelector('#qv-stage');
        if (stage && typeof Product3D !== 'undefined' && Product3D.mount) {
            Product3D.mount(stage, product);
        } else if (stage) {
            stage.classList.add('pv-stage');
            stage.innerHTML = product.image_url
                ? `<img class="pv-img" src="${product.image_url}" alt="${product.name}">`
                : `<div class="pv-hint">تصویری موجود نیست</div>`;
        }
    }
    openProduct(productId) {
        window.location.href = `/product?id=${productId}`;
    }
    async checkout(total, onClose) {
        if (!this.user.id) {
            Toast.show('ابتدا وارد سایت شوید', 'error');
            setTimeout(() => { window.location.href = '/login'; }, 900);
            return;
        }
        try {
            const items = this.cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.price
            }));
            await api.createOrder(items, total);
            Toast.show('سفارش شما با موفقیت ثبت شد ✅', 'success');
            if (window.soundManager) window.soundManager.play('success');
            this.cart = [];
            this.saveCart();
            this.updateNavBar();
            this.renderCartDrawer();
            if (typeof onClose === 'function') onClose();
        } catch (error) {
            if (error && error.shortages && error.shortages.length) {
                const names = error.shortages
                    .map(s => s.name ? `${s.name} (موجودی: ${s.available})` : '')
                    .filter(Boolean).join('، ');
                Toast.show('⚠️ موجودی کافی نیست: ' + names, 'error', 5000);
                this.pruneShortages(error.shortages);
            } else {
                Toast.show('خطا در ثبت سفارش: ' + error.message, 'error');
            }
        }
    }
    pruneShortages(shortages) {
        let changed = false;
        shortages.forEach(s => {
            if (!s.product_id) return;
            const item = this.cart.find(i => i.product_id === s.product_id);
            if (!item) return;
            if (typeof s.available === 'number' && s.available > 0) {
                item.quantity = s.available;
            } else {
                this.cart = this.cart.filter(i => i.product_id !== s.product_id);
            }
            changed = true;
        });
        if (changed) {
            this.saveCart();
            this.updateNavBar();
            this.renderCartDrawer();
        }
    }
    async logout() {
        try {
            await api.logout();
            clearUserData();
            window.location.href = '/';
        } catch (error) {
            console.error('خطا در خروج:', error);
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.store = new Store();
});
