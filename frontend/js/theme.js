class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'summer';
        this.themeToggle = document.getElementById('theme-toggle');
        this.init();
    }
    init() {
        this.applyTheme(this.currentTheme, false);
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
            if (btn !== this.themeToggle) {
                btn.addEventListener('click', () => this.toggleTheme());
            }
        });
    }
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'summer' ? 'dark' : 'summer';
        this.applyTheme(this.currentTheme, true);
        localStorage.setItem('theme', this.currentTheme);
        if (window.soundManager) window.soundManager.play('notify');
    }
    applyTheme(theme, animate = true) {
        const root = document.documentElement;
        const setAttrs = () => {
            root.setAttribute('data-theme', theme);
            root.style.colorScheme = theme === 'summer' ? 'light' : theme;
        };
        if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            root.classList.add('theme-transitioning');
            const style = document.createElement('style');
            style.textContent = `.theme-transitioning, .theme-transitioning * { transition: background-color .45s ease, color .45s ease, border-color .45s ease, box-shadow .45s ease !important; }`;
            document.head.appendChild(style);
            setAttrs();
            setTimeout(() => {
                root.classList.remove('theme-transitioning');
                style.remove();
            }, 500);
        } else {
            setAttrs();
        }
        document.querySelectorAll('#theme-toggle, [data-theme-toggle]').forEach(btn => {
            btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
            btn.setAttribute('aria-label', theme === 'dark' ? 'تغییر به تم تابستانی (کرم و قهوه‌ای)' : 'تغییر به تم تاریک');
        });
    }
}
window.themeManager = new ThemeManager();
const KEEP_ON_LOGOUT = ['theme', 'sound_enabled', 'sound_volume', 'sound_choice_made'];
window.clearUserData = function clearUserData() {
    const keep = {};
    KEEP_ON_LOGOUT.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) keep[key] = value;
    });
    localStorage.clear();
    Object.keys(keep).forEach(key => localStorage.setItem(key, keep[key]));
};
