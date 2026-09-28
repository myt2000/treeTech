// Minimal zero-dependency i18n runtime. Loaded before app.js / demo.js / sorted.js.
// The Chinese dictionary lives in i18n-zh.js (window.ZH_STRINGS / window.ZH_LABELS /
// window.ZH_STORY_CUTS); English stays inline in the markup and scripts as fallback.
(function () {
    'use strict';

    const STORAGE_KEY = 'techtree-lang';

    function detectLanguage() {
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved === 'zh' || saved === 'en') return saved;
        } catch (error) {
            // Storage may be unavailable (privacy mode); fall through to detection.
        }
        return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }

    const lang = detectLanguage();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = lang;

    function strings() {
        return window.ZH_STRINGS || {};
    }

    function labels() {
        return window.ZH_LABELS || {};
    }

    function t(key, fallback) {
        if (lang === 'zh') {
            const dict = strings();
            if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
        }
        return fallback;
    }

    function label(value) {
        if (lang !== 'zh' || typeof value !== 'string') return value;
        const map = labels();
        if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
        return value;
    }

    // Returns the raw Chinese entry for a technology id, or null.
    function zhEntry(id) {
        if (lang !== 'zh' || !zhData) return null;
        return Object.prototype.hasOwnProperty.call(zhData, id) ? zhData[id] : null;
    }

    // Returns a shallow copy of a technology with name/description localized when
    // a translation exists; otherwise the original object is returned untouched.
    function localize(tech) {
        if (lang !== 'zh' || !tech) return tech;
        const entry = zhEntry(tech.id);
        if (!entry) return tech;
        return {
            ...tech,
            name: entry.name || tech.name,
            description: entry.description || tech.description
        };
    }

    let zhData = null;

    async function loadData() {
        if (lang !== 'zh' || zhData) return zhData;
        try {
            const resp = await fetch('api/i18n/zh');
            if (resp.ok) zhData = await resp.json();
        } catch (error) {
            // Translations are optional; the English canonical data remains usable.
        }
        return zhData;
    }

    function applyDom(root = document) {
        if (lang !== 'zh') return;
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const dict = strings();
            if (Object.prototype.hasOwnProperty.call(dict, key)) el.textContent = dict[key];
        });
        root.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const dict = strings();
            if (Object.prototype.hasOwnProperty.call(dict, key)) el.innerHTML = dict[key];
        });
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const dict = strings();
            if (Object.prototype.hasOwnProperty.call(dict, key)) el.setAttribute('placeholder', dict[key]);
        });
        root.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            const dict = strings();
            if (Object.prototype.hasOwnProperty.call(dict, key)) el.setAttribute('aria-label', dict[key]);
        });
    }

    function bindToggle() {
        const button = document.getElementById('lang-toggle');
        if (!button) return;
        button.textContent = lang === 'zh' ? 'English' : '中文';
        button.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
        button.addEventListener('click', () => {
            try {
                window.localStorage.setItem(STORAGE_KEY, lang === 'zh' ? 'en' : 'zh');
            } catch (error) {
                // Without storage the toggle still works for this page load.
            }
            window.location.reload();
        });
    }

    function applyTitle() {
        const key = document.documentElement.getAttribute('data-i18n-title');
        if (!key) return;
        const dict = strings();
        if (Object.prototype.hasOwnProperty.call(dict, key)) document.title = dict[key];
    }

    window.addEventListener('DOMContentLoaded', () => {
        applyDom();
        applyTitle();
        bindToggle();
    });

    window.I18N = { lang, t, label, localize, zhEntry, loadData, applyDom };
}());
