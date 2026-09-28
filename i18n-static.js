// Static-page language toggle (tech/*.html, fields/*.html). Both languages are
// embedded in the generated pages; this script only switches the visible one.
// It lives in an external file because the server CSP forbids inline scripts.
(function () {
    'use strict';
    try {
        var saved = localStorage.getItem('techtree-lang');
        if (saved === 'zh' || saved === 'en') document.documentElement.dataset.lang = saved;
        var lang = document.documentElement.dataset.lang || 'en';
        var button = document.getElementById('lang-toggle');
        if (button) {
            button.textContent = lang === 'zh' ? 'English' : '中文';
            button.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
            button.addEventListener('click', function () {
                try {
                    localStorage.setItem('techtree-lang', lang === 'zh' ? 'en' : 'zh');
                } catch (error) { /* storage unavailable */ }
                window.location.reload();
            });
        }
    } catch (error) { /* keep the English layer visible */ }
}());
