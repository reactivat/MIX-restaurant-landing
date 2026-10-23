(function () {
    'use strict';

    const section = document.querySelector('.favorite');
    if (!section) return;
    const track = section.querySelector('.favorite__cards');
    const cards = Array.from(track.querySelectorAll('.dish'));
    const controls = section.querySelector('.favorite__controls');
    const previous = controls.querySelector('[data-favorite-step="-1"]');
    const next = controls.querySelector('[data-favorite-step="1"]');
    const status = section.querySelector('#favorite-status');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let drag = null;
    let queued = false;
    let destination = null;

    function maxScroll() { return Math.max(0, track.scrollWidth - track.clientWidth); }
    function stepSize() {
        return cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
    }

    function update() {
        queued = false;
        previous.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= maxScroll() - 2;
        if (destination !== null && Math.abs(track.scrollLeft - destination) < 2) destination = null;
    }

    function queueUpdate() {
        if (!queued) {
            queued = true;
            requestAnimationFrame(update);
        }
    }

    function navigate(left) {
        destination = Math.max(0, Math.min(maxScroll(), left));
        track.scrollTo({left: destination, behavior: motion.matches ? 'instant' : 'smooth'});
        const index = Math.min(cards.length - 1, Math.round(destination / stepSize()));
        status.textContent = cards[index].querySelector('.dish__heading').textContent +
            '. Блюдо ' + (index + 1) + ' из ' + cards.length;
        queueUpdate();
    }

    function nudge(by) {
        const base = destination === null ? track.scrollLeft : destination;
        const index = Math.round(base / stepSize());
        navigate((index + by) * stepSize());
    }

    controls.hidden = false;
    section.setAttribute('aria-roledescription', 'карусель');
    controls.addEventListener('click', function (event) {
        const button = event.target.closest('[data-favorite-step]');
        if (button && !button.disabled) nudge(Number(button.dataset.favoriteStep));
    });

    track.addEventListener('keydown', function (event) {
        if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowLeft') nudge(-1);
        else if (event.key === 'ArrowRight') nudge(1);
        else if (event.key === 'Home') navigate(0);
        else if (event.key === 'End') navigate(maxScroll());
        else return;
        event.preventDefault();
    });

    // Touch and trackpad scrolling stay native, including inertia and scroll snap.
    // Add dragging only for a desktop mouse; do not capture touchscreen pointers.
    track.addEventListener('pointerdown', function (event) {
        destination = null;
        if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary ||
            event.target.closest('button, a, input, select, textarea')) return;
        track.scrollTo({left: track.scrollLeft, behavior: 'instant'});
        drag = {id: event.pointerId, x: event.clientX, left: track.scrollLeft, moved: false};
        track.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    track.addEventListener('pointermove', function (event) {
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) < 6) return;
        drag.moved = true;
        track.classList.add('favorite__cards--dragging');
        track.scrollTo({left: drag.left - dx, behavior: 'instant'});
    });

    function endDrag(event) {
        if (!drag || drag.id !== event.pointerId) return;
        const finished = drag;
        drag = null;
        const left = track.scrollLeft;
        track.classList.remove('favorite__cards--dragging');
        if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
        if (finished.moved) {
            const dx = event.clientX - finished.x;
            const origin = Math.round(finished.left / stepSize());
            const by = Math.abs(dx) >= 32 ? -Math.sign(dx) : 0;
            const nearest = Math.round(left / stepSize());
            const index = by < 0 ? Math.min(origin + by, nearest) : by > 0 ? Math.max(origin + by, nearest) : nearest;
            navigate(index * stepSize());
        }
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('lostpointercapture', function (event) {
        if (event.target === track) endDrag(event);
    });
    track.addEventListener('wheel', function () { destination = null; }, {passive: true});
    track.addEventListener('scroll', queueUpdate, {passive: true});
    if ('ResizeObserver' in window) new ResizeObserver(function () {
        destination = null;
        queueUpdate();
    }).observe(track);
    else window.addEventListener('resize', queueUpdate);
    motion.addEventListener('change', function () {
        if (motion.matches && destination !== null) {
            track.scrollTo({left: destination, behavior: 'instant'});
        }
    });
    update();
})();
