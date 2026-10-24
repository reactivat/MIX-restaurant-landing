// Development only: the preview server injects this script only with ?audit.
(function () {
    'use strict';
    const report = { lcp: 0, cls: 0, longTasks: [], frames: [] };
    const output = document.createElement('script');
    output.type = 'application/json';
    output.id = 'mix-audit';
    document.head.append(output);
    ['largest-contentful-paint', 'layout-shift', 'longtask'].forEach(function (type) {
        if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
        new PerformanceObserver(function (list) {
            list.getEntries().forEach(function (entry) {
                if (type === 'largest-contentful-paint') report.lcp = entry.startTime;
                if (type === 'layout-shift' && !entry.hadRecentInput) report.cls += entry.value;
                if (type === 'longtask') report.longTasks.push(Math.round(entry.duration));
            });
        }).observe({ type: type, buffered: true });
    });
    let lastState = '';
    function sample() {
        const header = document.querySelector('.header');
        const nav = document.querySelector('.header__nav');
        if (header && nav) {
            const rect = nav.getBoundingClientRect();
            const style = getComputedStyle(nav);
            const state = { y: Math.round(scrollY), headerHeight: Math.round(header.getBoundingClientRect().height),
                menuVisible: style.visibility !== 'hidden' && rect.width > 0 && rect.left < innerWidth && rect.right > 0,
                menuOpen: header.classList.contains('header--menu-open') };
            const key = JSON.stringify(state);
            if (key !== lastState && report.frames.length < 120) {
                report.frames.push({ time: Math.round(performance.now()), ...state });
                lastState = key;
            }
        }
        if (performance.now() < 5000) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    function publish() {
        report.resources = performance.getEntriesByType('resource').filter(function (e) {
            return !e.name.includes('performance-audit.js');
        }).map(function (e) { return { name: new URL(e.name).pathname, bytes: e.encodedBodySize, type: e.initiatorType }; });
        report.navigation = performance.getEntriesByType('navigation').map(function (e) {
            return { bytes: e.encodedBodySize, domReady: e.domContentLoadedEventEnd, loaded: e.loadEventEnd, type: e.type };
        });
        report.paint = performance.getEntriesByType('paint').map(function (e) { return { name: e.name, time: e.startTime }; });
        report.width = innerWidth;
        report.dpr = devicePixelRatio;
        report.scrollY = Math.round(scrollY);
        output.textContent = JSON.stringify(report);
    }
    setInterval(publish, 500);
    addEventListener('load', publish);
})();
