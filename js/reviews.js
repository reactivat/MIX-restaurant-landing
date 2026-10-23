(function () {
    'use strict';

    const section = document.querySelector('.reviews');
    if (!section) return;

    const viewport = section.querySelector('.reviews__viewport');
    const list = section.querySelector('.reviews__list');
    const cards = Array.from(section.querySelectorAll('.review'));
    const controls = section.querySelector('.reviews__controls');
    const dots = Array.from(section.querySelectorAll('.reviews__dot'));
    const status = section.querySelector('#reviews-status');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const count = cards.length;
    if (count < 2) return;

    let position = 0;
    let target = 0;
    let width = 0;
    let selected = 0;
    let animation = null;
    let drag = null;
    let observedWidth = 0;
    const pitchRatio = 0.88;
    const indexAt = function (value) { return ((Math.round(value) % count) + count) % count; };

    function paint() {
        if (!width) return;
        cards.forEach(function (card, index) {
            let offset = ((index - position) % count + count) % count;
            if (offset > count / 2) offset -= count;
            const distance = Math.abs(offset);
            const ramp = Math.pow(distance, 0.56);
            const tilt = Math.min(38 * ramp, 82) * Math.sign(offset);
            // Fade only at the ring seam; three reviews still have visible neighbours.
            const edge = Math.min(1, Math.max(0, (count / 2 - distance) / 0.35));
            card.style.transform = 'translateX(calc(-50% + ' + offset * width * pitchRatio + 'px)) ' +
                'translateZ(' + -0.48 * width * ramp + 'px) rotateY(' + -tilt + 'deg)';
            card.style.opacity = String(Math.max(0, 1 - distance * 0.14) * edge);
            card.style.zIndex = String(100 - Math.round(distance * 10));
        });
    }

    function select(index, announce) {
        selected = index;
        cards.forEach(function (card, cardIndex) {
            card.setAttribute('aria-hidden', String(cardIndex !== index));
        });
        dots.forEach(function (dot, dotIndex) {
            dot.setAttribute('aria-current', String(dotIndex === index));
        });
        if (announce) {
            status.textContent = 'Отзыв ' + (index + 1) + ' из ' + count + '. ' +
                cards[index].querySelector('.review__name').textContent;
        }
    }

    function stopAnimation() {
        if (animation !== null) cancelAnimationFrame(animation);
        animation = null;
    }

    function settle(next, announce) {
        stopAnimation();
        target = next;
        select(indexAt(next), announce !== false);
        if (motion.matches) {
            position = target;
            paint();
            return;
        }
        let previousTime = performance.now();
        function step(now) {
            const remaining = target - position;
            if (Math.abs(remaining) < 0.0004) {
                // Keep the single position bounded after repeated loops.
                position = target = indexAt(target);
                paint();
                animation = null;
                return;
            }
            const elapsed = Math.min(64, Math.max(1, now - previousTime));
            position += remaining * (1 - Math.exp(-elapsed / 85));
            previousTime = now;
            paint();
            animation = requestAnimationFrame(step);
        }
        animation = requestAnimationFrame(step);
    }

    function goTo(index) {
        settle(index + Math.round((target - index) / count) * count);
    }

    function nudge(by) {
        settle(Math.round(target) + by);
    }

    function measure() {
        // Measure untransformed natural content, including wrapped names and zoomed text.
        cards.forEach(function (card) { card.style.height = 'auto'; });
        width = cards[0].offsetWidth;
        const height = Math.max.apply(null, cards.map(function (card) { return card.offsetHeight; }));
        list.style.setProperty('--review-height', height + 'px');
        cards.forEach(function (card) { card.style.removeProperty('height'); });
        viewport.style.perspective = width * 3 + 'px';
        paint();
    }

    section.classList.add('reviews--enhanced');
    section.setAttribute('aria-roledescription', 'карусель');
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'group');
    viewport.setAttribute('aria-label', 'Отзывы гостей. Область перелистывания');
    cards.forEach(function (card, index) {
        card.setAttribute('role', 'group');
        card.setAttribute('aria-roledescription', 'слайд');
        card.setAttribute('aria-label', (index + 1) + ' из ' + count);
    });
    controls.hidden = false;
    select(0, false);
    measure();

    controls.addEventListener('click', function (event) {
        const step = event.target.closest('[data-review-step]');
        const dot = event.target.closest('[data-review-index]');
        if (step) nudge(Number(step.dataset.reviewStep));
        if (dot) goTo(Number(dot.dataset.reviewIndex));
    });

    viewport.addEventListener('keydown', function (event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowLeft') nudge(-1);
        else if (event.key === 'ArrowRight') nudge(1);
        else if (event.key === 'Home') goTo(0);
        else if (event.key === 'End') goTo(count - 1);
        else return;
        event.preventDefault();
    });

    viewport.addEventListener('pointerdown', function (event) {
        if (!event.isPrimary || event.button !== 0 || drag) return;
        stopAnimation();
        target = position;
        drag = {
            id: event.pointerId, x: event.clientX, y: event.clientY,
            position: position, moved: false,
            card: event.target.closest('.review')
        };
        // Touch implicitly captures the child that was touched. Choose the frame
        // before the first move so transferring that capture cannot end the drag.
        viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener('pointermove', function (event) {
        if (!drag || drag.id !== event.pointerId || !width) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
            if (Math.abs(dy) > Math.abs(dx) * 1.2) {
                drag = null;
                if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
                settle(Math.round(position), false);
                return;
            }
            if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
            drag.moved = true;
        }
        position = drag.position - dx / (width * pitchRatio);
        paint();
    });

    function endDrag(event) {
        if (!drag || drag.id !== event.pointerId) return;
        const finished = drag;
        drag = null;
        if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
        const cancelled = event.type !== 'pointerup';
        if (cancelled) {
            settle(Math.round(finished.position), false);
        } else if (finished.moved) {
            // One deliberate swipe advances one review, even when released slowly.
            const dx = event.clientX - finished.x;
            const threshold = Math.min(40, Math.max(24, width * 0.08));
            const by = Math.abs(dx) >= threshold ? -Math.sign(dx) : 0;
            settle(Math.round(finished.position) + by, by !== 0);
        } else if (!cancelled && finished.card) {
            goTo(cards.indexOf(finished.card));
        } else {
            settle(Math.round(position), false);
        }
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('lostpointercapture', function (event) {
        // A child's implicit touch capture can bubble here; it is not our loss.
        if (event.target === viewport) endDrag(event);
    });
    // Mouse can leave the frame before a horizontal gesture captures the pointer.
    viewport.addEventListener('pointerleave', function (event) {
        if (drag && !drag.moved) endDrag(event);
    });

    if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(function (entries) {
            const nextWidth = entries[0].contentRect.width;
            if (nextWidth !== observedWidth) {
                observedWidth = nextWidth;
                measure();
            }
        });
        observer.observe(viewport);
    } else {
        window.addEventListener('resize', measure);
    }
    if (document.fonts) document.fonts.ready.then(measure);
    motion.addEventListener('change', function () {
        if (motion.matches) {
            drag = null;
            settle(Math.round(target), false);
        }
    });
    window.addEventListener('pagehide', function () {
        drag = null;
        stopAnimation();
        position = target = selected;
        paint();
    });
})();
