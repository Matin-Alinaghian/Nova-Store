class API {
    constructor(baseURL = window.location.origin) {
        this.baseURL = baseURL;
    }
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            ...options
        };
        try {
            const response = await fetch(url, config);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const err = new Error(data.error || 'خطای نامشخص');
                if (data.shortages) err.shortages = data.shortages;
                throw err;
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }
    register(username, email, password) {
        return this.request('/api/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
    }
    logout() {
        return this.request('/api/logout', {
            method: 'POST'
        });
    }
    getProducts() {
        return this.request('/api/products');
    }
    getProduct(id) {
        return this.request(`/api/products/${id}`);
    }
    addProduct(product) {
        return this.request('/api/products', {
            method: 'POST',
            body: JSON.stringify(product)
        });
    }
    uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        return this.request('/api/upload', {
            method: 'POST',
            headers: {},
            body: formData
        });
    }
    updateProduct(id, product) {
        return this.request(`/api/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(product)
        });
    }
    deleteProduct(id) {
        return this.request(`/api/products/${id}`, {
            method: 'DELETE'
        });
    }
    createOrder(items, totalPrice) {
        return this.request('/api/orders', {
            method: 'POST',
            body: JSON.stringify({ items, total_price: totalPrice })
        });
    }
    getOrders() {
        return this.request('/api/orders');
    }
    getOrderDetail(id) {
        return this.request(`/api/orders/${id}`);
    }
    getMyOrders() {
        return this.request('/api/my-orders');
    }
    getUsers() {
        return this.request('/api/users');
    }
}
const api = new API();
