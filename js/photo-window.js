(function () {
    'use strict';

    const frame = document.querySelector('.photo-window');
    if (!frame || !frame.querySelector('.photo-window__image')) return;

    const mobile = window.matchMedia('(max-width: 800px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let enabled = false;
    let request = null;

    function paint() {
        request = null;
        if (!enabled || document.hidden) return;
        const rect = frame.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        if (rect.bottom <= 0 || rect.top >= viewportHeight) return;

        // The photo is taller than its frame, so the full travel stays covered.
        const distance = viewportHeight / 2 - (rect.top + rect.height / 2);
        const shift = Math.max(-72, Math.min(72, distance * 0.18));
        frame.style.setProperty('--photo-window-shift', shift.toFixed(2) + 'px');
    }

    function queuePaint() {
        if (enabled && !document.hidden && request === null) {
            request = window.requestAnimationFrame(paint);
        }
    }

    function sync() {
        enabled = mobile.matches && !reducedMotion.matches;
        frame.classList.toggle('photo-window--animated', enabled);
        if (request !== null) window.cancelAnimationFrame(request);
        request = null;
        if (enabled) paint();
        else frame.style.removeProperty('--photo-window-shift');
    }

    window.addEventListener('scroll', queuePaint, {passive: true});
    window.addEventListener('resize', queuePaint);
    window.addEventListener('pageshow', queuePaint);
    document.addEventListener('visibilitychange', queuePaint);
    mobile.addEventListener('change', sync);
    reducedMotion.addEventListener('change', sync);
    sync();
})();
