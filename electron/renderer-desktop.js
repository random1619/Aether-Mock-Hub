/**
 * Desktop bridge — loaded by the bundled pages ONLY when running under
 * Electron. Wires native features into the existing static app WITHOUT
 * changing its logic:
 *
 *   - Native theme sync (menu "Toggle Dark/Light" drives AetherUtils).
 *   - "Open PDF from disk" → feeds bytes into pdf-reader.html (no file:// CORS).
 *   - Kiosk state visual cue.
 *
 * This file is served from the content server alongside public/, but is only
 * ever injected when window.aetherDesktop exists (i.e. inside Electron).
 * In a plain browser it is never loaded, so the web build is unaffected.
 */
(function () {
    'use strict';
    if (!window.aetherDesktop || !window.aetherDesktop.isDesktop) return;
    // Injected on every dom-ready — bail if already wired so d.on()
    // subscriptions don't stack across navigations.
    if (window.__aetherBridgeInjected) return;
    window.__aetherBridgeInjected = true;

    var d = window.aetherDesktop;

    /* ── Native menu → theme toggle ─────────────────────────── */
    d.on('aether:toggle-theme', function () {
        if (window.AetherUtils && AetherUtils.toggleTheme) {
            AetherUtils.toggleTheme();
            var t = document.documentElement.getAttribute('data-theme') || 'dark';
            d.setTheme(t); // persist for next launch + native title bar
        }
    });

    /* ── External PDF (from OS open dialog) → pdf-reader ────── */
    d.on('aether:open-external-pdf', function (payload) {
        if (!payload || !payload.data) return;
        var file;
        try {
            var bytes = Uint8Array.from(atob(payload.data), function (c) { return c.charCodeAt(0); });
            file = new File([bytes], payload.name || 'document.pdf', { type: 'application/pdf' });
        } catch (e) {
            console.warn('[desktop] failed to decode external PDF', e);
            return;
        }
        // loadPDF is defined by pdf-reader.html's inline script, which may not
        // have run yet when this event lands. Poll briefly, then give up.
        var attempts = 0;
        (function tryLoad() {
            if (typeof window.loadPDF === 'function') { window.loadPDF(file); return; }
            if (++attempts < 40) setTimeout(tryLoad, 100);
            else console.warn('[desktop] loadPDF unavailable — not on the reader page');
        })();
    });

    /* ── Kiosk visual cue ───────────────────────────────────── */
    d.on('aether:kiosk-changed', function (on) {
        document.body.classList.toggle('kiosk-mode', !!on);
    });

    /* ── Tray "Resume Last Exam" → navigate to exam if a
       progress snapshot exists ────────────────────────────────── */
    d.on('aether:resume-last', function () {
        try {
            var snap = JSON.parse(localStorage.getItem('aether-exam-progress') || 'null');
            if (snap && snap.path) {
                // Use the shared exam-link encoder (window.btoa is always available).
                var encoded = snap.path.split('').map(function (c) {
                    return '%' + c.charCodeAt(0).toString(16).padStart(2, '0');
                }).join('');
                window.location.href = '/v2/exam/' + encoded;
            }
        } catch { /* ignore */ }
    });

    /* ── Persist the theme at boot so the native title bar matches ── */
    try {
        var current = document.documentElement.getAttribute('data-theme') || 'dark';
        d.setTheme(current);
    } catch { /* ignore */ }
})();
