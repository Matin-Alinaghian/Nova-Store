class AdminPanel {
    constructor() {
        this.currentTab = 'products';
        this.products = [];
        this.orders = [];
        this.users = [];
        this.init();
    }
    init() {
        this.setupTabs();
        this.loadData();
        this.setupForms();
        this.setupNavbarScroll();
    }
    setupNavbarScroll() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        const handleScroll = () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
    }
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                const tabId = `${button.dataset.tab}-tab`;
                document.getElementById(tabId).classList.add('active');
                this.currentTab = button.dataset.tab;
                this.loadData();
            });
        });
    }
    async loadData() {
        if (this.currentTab === 'products') {
            await this.loadProducts();
        } else if (this.currentTab === 'orders') {
            await this.loadOrders();
        } else if (this.currentTab === 'users') {
            await this.loadUsers();
        }
    }
    async loadProducts() {
        try {
            this.products = await api.getProducts();
            this.displayProducts();
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }
    displayProducts() {
        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;
        tbody.innerHTML = this.products.map(product => {
            const is3d = !(product.use_3d === 0 || product.use_3d === false || product.use_3d === '0');
            return `
            <tr class="animate-fade-in">
                <td style="font-weight:600;color:var(--text-primary)">${product.name} <span class="user-role ${is3d ? 'admin' : ''}" style="font-size:.7rem">${is3d ? 'سه‌بعدی' : 'عادی'}</span></td>
                <td>${product.price.toLocaleString('fa-IR')} تومان</td>
                <td>${product.quantity}</td>
                <td>${product.category || '-'}</td>
                <td>${product.discount_price ? `${product.discount_percent || ''}٪` : '-'}</td>
                <td>${product.featured ? '<span class="user-role admin">ویژه</span>' : '<span class="user-role">عادی</span>'}</td>
                <td>
                    <button class="btn btn-small btn-ghost" onclick="adminPanel.editProduct(${product.id})">ویرایش</button>
                    <button class="btn btn-small btn-ghost" onclick="adminPanel.rebuild3D(${product.id})" title="ساخت دوباره مدل سه‌بعدی">3D</button>
                    <button class="btn btn-small btn-danger" onclick="adminPanel.deleteProduct(${product.id})">حذف</button>
                </td>
            </tr>
        `;
        }).join('');
    }
    async loadOrders() {
        try {
            this.orders = await api.getOrders();
            this.displayOrders();
        } catch (error) {
            console.error('Error loading orders:', error);
            const tbody = document.getElementById('orders-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="7">${error.message}</td></tr>`;
        }
    }
    displayOrders() {
        const tbody = document.getElementById('orders-tbody');
        if (!tbody) return;
        tbody.innerHTML = this.orders.map(order => {
            const summary = this.orderItemsSummary(order);
            return `
            <tr class="animate-fade-in">
                <td>#${order.id}</td>
                <td>${order.user_name || order.username || '-'}</td>
                <td>${order.total_price ? order.total_price.toLocaleString('fa-IR') : 0} تومان</td>
                <td>${summary}</td>
                <td><span class="user-role">${this.statusFa(order.status)}</span></td>
                <td>${this.faDateTime(order.created_at)}</td>
                <td>
                    <button class="btn btn-small btn-primary" onclick="adminPanel.viewOrderDetails(${order.id})">جزئیات</button>
                </td>
            </tr>`;
        }).join('');
    }
    statusFa(status) {
        const map = {
            pending: 'در انتظار بررسی',
            processing: 'در حال پردازش',
            shipped: 'ارسال شده',
            delivered: 'تحویل داده شده',
            cancelled: 'لغو شده'
        };
        return map[status] || status || 'در انتظار بررسی';
    }
    faDateTime(dt) {
        if (!dt) return '—';
        const s = String(dt);
        const [datePart, timePart] = s.split(' ');
        try {
            const d = new Date(datePart + 'T' + (timePart || '00:00'));
            if (isNaN(d.getTime())) return s;
            const fa = d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
            return timePart ? `${fa} — ${timePart}` : fa;
        } catch (e) { return s; }
    }
    orderItemsSummary(order) {
        const raw = order && order.items;
        if (!raw || typeof raw !== 'string') return '—';
        const pairs = raw.split(',').map(p => p.split(':'));
        const kinds = pairs.filter(p => p.length >= 2 && p[0]).length;
        const qty = pairs.reduce((s, p) => s + (parseInt(p[1]) || 0), 0);
        if (!kinds) return '—';
        return `${kinds.toLocaleString('fa-IR')} قلم / ${qty.toLocaleString('fa-IR')} عدد`;
    }
    async viewOrderDetails(orderId) {
        const modal = document.getElementById('order-modal');
        const body = document.getElementById('order-details-body');
        if (!modal || !body) return;
        body.innerHTML = '<div class="order-empty-msg">در حال بارگذاری جزئیات…</div>';
        modal.classList.add('open');
        try {
            const order = await api.getOrderDetail(orderId);
            body.innerHTML = this.renderOrderDetails(order);
        } catch (error) {
            body.innerHTML = `<div class="order-empty-msg">خطا در دریافت جزئیات: ${error.message}</div>`;
        }
    }
    escapeAttr(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    renderOrderDetails(order) {
        const items = order.items || [];
        const rows = items.length
            ? items.map(it => {
                const name = it.name || 'محصول حذف‌شده';
                const category = it.category || '';
                const img = it.image_url
                    ? `<img src="${this.escapeAttr(it.image_url)}" alt="" onerror="this.outerHTML='<div class=order-item-ph>📦</div>'">`
                    : '<div class="order-item-ph">📦</div>';
                return `
                    <div class="order-item-row">
                        ${img}
                        <div class="order-item-info">
                            <b title="${this.escapeAttr(name)}">${name}</b>
                            <small>قیمت واحد: ${Number(it.price).toLocaleString('fa-IR')} تومان${category ? ' — ' + category : ''}</small>
                        </div>
                        <span class="order-item-qty">${Number(it.quantity).toLocaleString('fa-IR')} عدد</span>
                        <span class="order-item-sum">${Number(it.line_total).toLocaleString('fa-IR')} تومان</span>
                    </div>`;
            }).join('')
            : '<div class="order-empty-msg">برای این سفارش قلم کالایی در سیستم ثبت نشده است</div>';
        const date = this.faDateTime(order.created_at);
        return `
            <div class="order-meta">
                <div class="order-meta-item"><span>شماره سفارش</span><b>#${order.id}</b></div>
                <div class="order-meta-item"><span>مشتری</span><b>${order.username || '-'}</b></div>
                <div class="order-meta-item"><span>ایمیل</span><b class="long-value">${order.email || '-'}</b></div>
                <div class="order-meta-item"><span>وضعیت</span><b>${this.statusFa(order.status)}</b></div>
                <div class="order-meta-item"><span>تاریخ سفارش</span><b>${date}</b></div>
                <div class="order-meta-item"><span>تعداد کل اقلام</span><b>${Number(order.items_count || 0).toLocaleString('fa-IR')} عدد</b></div>
            </div>
            <div class="order-items-title">🛍 کالاهای سفارش‌داده‌شده (${items.length.toLocaleString('fa-IR')} قلم)</div>
            ${rows}
            <div class="order-total-row">
                <span>جمع کل سفارش</span>
                <span>${Number(order.total_price || 0).toLocaleString('fa-IR')} تومان</span>
            </div>`;
    }
    closeOrderDetails() {
        const modal = document.getElementById('order-modal');
        if (modal) modal.classList.remove('open');
    }
    async loadUsers() {
        try {
            this.users = await api.getUsers();
            this.displayUsers();
        } catch (error) {
            console.error('Error loading users:', error);
            const tbody = document.getElementById('users-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
        }
    }
    displayUsers() {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;
        tbody.innerHTML = this.users.map(user => `
            <tr class="animate-fade-in">
                <td>#${user.id}</td>
                <td style="font-weight:600;color:var(--text-primary)">${user.username}</td>
                <td>${user.email}</td>
                <td><span class="user-role ${user.is_admin ? 'admin' : ''}">${user.is_admin ? 'ادمین' : 'کاربر'}</span></td>
                <td>${user.created_at || '—'}</td>
                <td>${user.last_login || 'هرگز'}</td>
            </tr>
        `).join('');
    }
    setupForms() {
        const addForm = document.getElementById('add-product-form');
        if (addForm) {
            addForm.addEventListener('submit', (e) => this.handleAddProduct(e));
        }
        const editForm = document.getElementById('edit-product-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEditProduct(e));
        }
        const orderModal = document.getElementById('order-modal');
        if (orderModal) {
            const closeBtn = orderModal.querySelector('.close-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeOrderDetails());
            orderModal.addEventListener('click', (e) => {
                if (e.target === orderModal) this.closeOrderDetails();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeOrderDetails();
            });
        }
        const loginLink = document.getElementById('login-link');
        const logoutBtn = document.getElementById('logout-btn');
        const adminLink = document.getElementById('admin-link');
        const userId = localStorage.getItem('user_id');
        const isAdmin = localStorage.getItem('is_admin');
        if (userId) {
            if (loginLink) loginLink.style.display = 'none';
            if (logoutBtn) {
                logoutBtn.style.display = 'inline-block';
                logoutBtn.addEventListener('click', () => this.logout());
            }
            if (adminLink && ['true', '1', 'yes'].includes((isAdmin || '').toLowerCase())) {
                adminLink.style.display = 'inline-block';
            }
        } else {
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    }
    async handleAddProduct(e) {
        e.preventDefault();
        const imageFile = document.getElementById('product-image-file').files[0];
        let imageUrl = document.getElementById('product-image').value;
        let model3d = null;
        try {
            if (imageFile) {
                const uploadResult = await api.uploadImage(imageFile);
                imageUrl = uploadResult.image_url;
                model3d = uploadResult.model3d || null;
            }
            const use3d = document.getElementById('product-use-3d').checked;
            const product = {
                name: document.getElementById('product-name').value.trim(),
                description: document.getElementById('product-description').value.trim(),
                price: parseFloat(document.getElementById('product-price').value),
                quantity: parseInt(document.getElementById('product-quantity').value),
                category: document.getElementById('product-category').value.trim(),
                image_url: imageUrl,
                discount_price: document.getElementById('product-discount-price').value || null,
                featured: document.getElementById('product-featured').checked,
                use_3d: use3d
            };
            await api.addProduct(product);
            if (!use3d) {
                Toast.show('محصول اضافه شد (نمایش عادی تصویر)', 'success', 3000);
            } else if (model3d && model3d.glb) {
                Toast.show('محصول اضافه شد و مدل سه‌بعدی تصویر ساخته شد ✦', 'success', 3200);
            } else if (imageFile) {
                Toast.show('محصول اضافه شد (ساخت مدل سه‌بعدی انجام نشد)', 'info', 3000);
            } else {
                Toast.show('محصول با موفقیت اضافه شد', 'success');
            }
            e.target.reset();
            await this.loadProducts();
        } catch (error) {
            Toast.show('خطا: ' + error.message, 'error');
        }
    }
    editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        document.getElementById('edit-product-id').value = product.id;
        document.getElementById('edit-product-name').value = product.name;
        document.getElementById('edit-product-price').value = product.price;
        document.getElementById('edit-product-quantity').value = product.quantity;
        document.getElementById('edit-product-discount-price').value = product.discount_price || '';
        document.getElementById('edit-product-featured').checked = Boolean(product.featured);
        document.getElementById('edit-product-use-3d').checked = !(product.use_3d === 0 || product.use_3d === false || product.use_3d === '0');
        document.getElementById('edit-product-description').value = product.description || '';
        document.getElementById('edit-product-category').value = product.category || '';
        document.getElementById('edit-product-image').value = product.image_url || '';
        document.getElementById('edit-modal').classList.add('open');
    }
    async handleEditProduct(e) {
        e.preventDefault();
        const productId = parseInt(document.getElementById('edit-product-id').value);
        const product = {
            name: document.getElementById('edit-product-name').value,
            price: parseFloat(document.getElementById('edit-product-price').value),
            discount_price: document.getElementById('edit-product-discount-price').value || null,
            quantity: parseInt(document.getElementById('edit-product-quantity').value),
            description: document.getElementById('edit-product-description').value,
            image_url: document.getElementById('edit-product-image').value,
            category: document.getElementById('edit-product-category').value,
            featured: document.getElementById('edit-product-featured').checked,
            use_3d: document.getElementById('edit-product-use-3d').checked
        };
        try {
            await api.updateProduct(productId, product);
            Toast.show('تغییرات ذخیره شد', 'success');
            document.getElementById('edit-modal').classList.remove('open');
            await this.loadProducts();
        } catch (error) {
            Toast.show('خطا: ' + error.message, 'error');
        }
    }
    async deleteProduct(productId) {
        if (!confirm('آیا از حذف این محصول مطمئن هستید؟')) return;
        try {
            await api.deleteProduct(productId);
            Toast.show('محصول حذف شد', 'success');
            await this.loadProducts();
        } catch (error) {
            Toast.show('خطا: ' + error.message, 'error');
        }
    }
    async rebuild3D(productId) {
        Toast.show('در حال ساخت مدل سه‌بعدی…', 'info', 2200);
        try {
            const r = await fetch(`/api/products/${productId}/model3d`, { method: 'POST', credentials: 'include' });
            const d = await r.json();
            if (d.status === 'ready') {
                Toast.show('مدل سه‌بعدی محصول ساخته شد ✦', 'success', 3000);
            } else if (d.status === 'none') {
                Toast.show(d.message || 'این تصویر برای ساخت مدل مناسب نیست و مثل قبل با کیفیت کامل نمایش داده می‌شود', 'info', 3600);
            } else {
                Toast.show(d.error || 'ساخت مدل سه‌بعدی ممکن نشد', 'error', 3200);
            }
        } catch (err) {
            Toast.show('خطا در ساخت مدل سه‌بعدی', 'error');
        }
    }
    async logout() {
        try {
            await api.logout();
            clearUserData();
            window.location.href = '/';
        } catch (error) {
            console.error('Error:', error);
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});
