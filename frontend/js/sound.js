class SoundManager {
    constructor() {
        const stored = localStorage.getItem('sound_enabled');
        this.enabled = stored !== 'off';
        this.volume = parseFloat(localStorage.getItem('sound_volume') || '0.5');
        this.ctx = null;
        this._unlocked = false;
        this._promptEl = null;
        const unlock = () => {
            if (this._unlocked) return;
            this._unlocked = true;
            try { this._ensureCtx(); } catch (e) {  }
            if (this.enabled) {
                this._showPromptOnce();
            } else if (!localStorage.getItem('sound_choice_made')) {
                this._showPromptOnce();
            }
        };
        window.addEventListener('pointerdown', unlock, { once: false, passive: true });
        window.addEventListener('keydown', unlock, { once: false });
    }
    _ensureCtx() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) throw new Error('WebAudio not supported');
            this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }
    setEnabled(on) {
        this.enabled = !!on;
        localStorage.setItem('sound_enabled', on ? 'on' : 'off');
        localStorage.setItem('sound_choice_made', '1');
        if (on) {
            try { this._ensureCtx(); } catch (e) { return; }
            this.play('notify');
        }
        document.dispatchEvent(new CustomEvent('soundchange', { detail: { enabled: this.enabled } }));
    }
    setVolume(v) {
        this.volume = Math.min(1, Math.max(0, v));
        localStorage.setItem('sound_volume', String(this.volume));
    }
    _tone(freq, dur, type = 'sine', gain = 0.12, when = 0, slideTo = null) {
        if (!this.enabled) return;
        let ctx;
        try { ctx = this._ensureCtx(); } catch (e) { return; }
        const t0 = ctx.currentTime + when;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(523.25, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * this.volume), t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
    }
    play(name) {
        switch (name) {
            case 'click':
                this._tone(1250, 0.07, 'sine', 0.10);
                break;
            case 'hover':
                this._tone(1900, 0.045, 'sine', 0.03);
                break;
            case 'add':
                this._tone(620, 0.09, 'sine', 0.12);
                this._tone(930, 0.14, 'sine', 0.12, 0.08);
                break;
            case 'success':
                this._tone(660, 0.1, 'sine', 0.11);
                this._tone(880, 0.1, 'sine', 0.11, 0.09);
                this._tone(1320, 0.2, 'sine', 0.1, 0.18);
                break;
            case 'notify':
                this._tone(980, 0.08, 'triangle', 0.09);
                this._tone(1460, 0.12, 'triangle', 0.07, 0.07);
                break;
            case 'wish':
                this._tone(1560, 0.12, 'sine', 0.09, 0, 2200);
                break;
            case 'error':
                this._tone(300, 0.16, 'square', 0.05, 0, 200);
                break;
        }
    }
    _showPromptOnce() {
        if (this._promptEl || document.querySelector('.sound-prompt')) return;
        const el = document.createElement('div');
        el.className = 'sound-prompt';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'فعال‌سازی صدا');
        el.innerHTML = `
            <span>🔊 فعال‌سازی صداهای سایت؟</span>
            <span class="sp-actions">
                <button type="button" class="sp-on">روشن</button>
                <button type="button" class="sp-off">خاموش</button>
            </span>`;
        el.querySelector('.sp-on').addEventListener('click', () => {
            this.setEnabled(true);
            el.remove();
        });
        el.querySelector('.sp-off').addEventListener('click', () => {
            this.setEnabled(false);
            el.remove();
        });
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 600);
        }, 8000);
        this._promptEl = el;
    }
}
window.soundManager = new SoundManager();
document.addEventListener('DOMContentLoaded', () => {
    const sm = window.soundManager;
    const isDesktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    document.addEventListener('click', (e) => {
        const t = e.target.closest('button, a, .chip, .suggestion-item, [role="button"]');
        if (t && !t.dataset.silent) sm.play('click');
    }, { capture: true });
    if (isDesktopPointer) {
        let lastHover = 0;
        document.addEventListener('mouseover', (e) => {
            const t = e.target.closest('.btn, .icon-btn, .chip, .product-action-btn, .suggestion-item');
            if (t && Date.now() - lastHover > 120) {
                lastHover = Date.now();
                sm.play('hover');
            }
        }, { passive: true });
    }
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn && !soundBtn.dataset.soundBound) {
        soundBtn.dataset.soundBound = '1';
        const pop = (soundBtn.parentElement && soundBtn.parentElement.querySelector('.sound-pop')) || document.getElementById('sound-pop');
        const updateIcon = () => {
            soundBtn.innerHTML = sm.enabled ? '🔊' : '🔇';
            soundBtn.classList.toggle('muted', !sm.enabled);
        };
        updateIcon();
        document.addEventListener('soundchange', updateIcon);
        soundBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pop) pop.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
            if (pop && !pop.contains(e.target) && e.target !== soundBtn) pop.classList.remove('show');
        });
        const sw = pop && pop.querySelector('#sound-switch');
        if (sw) {
            sw.checked = sm.enabled;
            sw.addEventListener('change', () => sm.setEnabled(sw.checked));
        }
        const vol = pop && pop.querySelector('#sound-volume');
        if (vol) {
            vol.value = sm.volume;
            vol.addEventListener('input', () => {
                sm.setVolume(parseFloat(vol.value));
                sm.play('notify');
            });
        }
    }
});
