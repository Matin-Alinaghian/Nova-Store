const Toast = (() => {
    let container = null;
    function ensure() {
        if (container && document.body.contains(container)) return container;
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
        return container;
    }
    function show(message, type = 'info', duration = 3200) {
        const box = ensure();
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        const icons = { success: '✓', error: '✕', info: '◆' };
        el.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-msg">${message}</span>`;
        box.appendChild(el);
        if (window.soundManager) {
            window.soundManager.play(type === 'success' ? 'success' : type === 'error' ? 'error' : 'notify');
        }
        setTimeout(() => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 400);
        }, duration);
        return el;
    }
    return { show };
})();
