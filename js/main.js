(function () {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionEase = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const entranceAnimations = new Map();

    // Контент виден без JS; анимация добавляется только в момент появления.
    function animateEntrance(element, delay, distance) {
        if (reducedMotion.matches || !element || !element.animate) {
            return;
        }

        const previous = entranceAnimations.get(element);
        if (previous) {
            previous.cancel();
        }
        const animation = element.animate([
            { opacity: 0, transform: 'translateY(' + distance + 'px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 640, delay: delay, easing: motionEase, fill: 'backwards' });
        entranceAnimations.set(element, animation);
        const cleanup = function () {
            if (entranceAnimations.get(element) === animation) {
                entranceAnimations.delete(element);
            }
        };
        animation.finished.then(cleanup, cleanup);
    }

    reducedMotion.addEventListener('change', function () {
        if (reducedMotion.matches) {
            entranceAnimations.forEach(function (animation) { animation.finish(); });
        }
    });

    function initMotion() {
        if (!('IntersectionObserver' in window)) {
            return;
        }

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }
                observer.unobserve(entry.target);
                if (!document.documentElement.classList.contains('page-ready')) return;
                if (entry.target.classList.contains('dish')) {
                    const index = Array.from(entry.target.parentElement.children).indexOf(entry.target);
                    const delay = window.matchMedia('(min-width: 801px)').matches ? index * 65 : 0;
                    animateEntrance(entry.target, delay, 20);
                } else {
                    animateEntrance(entry.target, 0, 18);
                }
            });
        }, { threshold: 0.08 });

        document.querySelectorAll('.advantages__list, .about__content, .about__figure, .favorite__header, .dish, .order, .reviews__header, .contact__info').forEach(function (element) {
            observer.observe(element);
        });

        document.querySelectorAll('details').forEach(function (details) {
            details.addEventListener('toggle', function () {
                if (details.open) {
                    Array.from(details.children).filter(function (child) {
                        return child.tagName !== 'SUMMARY';
                    }).forEach(function (child) { animateEntrance(child, 0, 8); });
                }
            });
        });

        document.addEventListener('focusin', function (event) {
            entranceAnimations.forEach(function (animation, element) {
                if (element.contains(event.target)) {
                    animation.finish();
                }
            });
        });
    }

    // Два кадра остаются в одной области до завершения перехода.
    function createPanelSwitcher(panels, duration, movement) {
        let animations = [];

        reducedMotion.addEventListener('change', function () {
            if (reducedMotion.matches) {
                animations.forEach(function (animation) { animation.finish(); });
            }
        });

        return function (index) {
            animations.forEach(function (animation) { animation.cancel(); });
            animations = [];
            const outgoing = panels.find(function (panel) { return !panel.hidden && panel.getAttribute('aria-hidden') !== 'true'; });
            const incoming = panels[index];

            panels.forEach(function (panel) {
                panel.hidden = panel !== outgoing && panel !== incoming;
                panel.setAttribute('aria-hidden', String(panel !== incoming));
            });
            incoming.hidden = false;

            if (!outgoing || outgoing === incoming || reducedMotion.matches) {
                panels.forEach(function (panel) { panel.hidden = panel !== incoming; });
                return;
            }

            const options = { duration: duration, easing: motionEase };
            const exit = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], options);
            const enter = incoming.animate([
                { opacity: 0, transform: 'translateY(' + movement + 'px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], options);
            animations = [exit, enter];
            enter.finished.then(function () {
                outgoing.hidden = true;
                animations = [];
            }).catch(function () { /* Следующее переключение отменяет предыдущий переход. */ });
        };
    }

    function initNavigation() {
        const header = document.querySelector('.header');
        const toggle = header.querySelector('.header__toggle');
        const navigation = header.querySelector('.header__nav');
        const mobile = window.matchMedia('(max-width: 800px)');
        const shell = header.querySelector('.header__menu-shell');
        const backdrop = header.querySelector('.header__backdrop');
        const curves = Array.from(header.querySelectorAll('.header__curve path')).map(function (path) {
            return { path: path, amount: 0 };
        });
        const links = Array.from(navigation.querySelectorAll('.header__nav-link[href^="#"]'));
        const sections = links.map(function (link) {
            return { link: link, target: document.getElementById(link.hash.slice(1)) };
        }).filter(function (section) { return section.target; });
        let updateQueued = false;
        let menuOpen = false;
        let curveFrame = 0;
        let originalBodyPadding = null;
        const inertElements = new Map();

        links.forEach(function (link, index) {
            link.parentElement.style.setProperty('--menu-index', index);
        });

        header.classList.add('header--enhanced');
        toggle.hidden = false;

        function syncCurrentLink() {
            const readingLine = header.getBoundingClientRect().bottom + Math.min(window.innerHeight * 0.28, 240);
            let current = null;
            let currentTop = -Infinity;

            sections.forEach(function (section) {
                const top = section.target.getBoundingClientRect().top;

                if (top <= readingLine && top > currentTop) {
                    current = section.link;
                    currentTop = top;
                }
            });

            links.forEach(function (link) {
                if (link === current) {
                    link.setAttribute('aria-current', 'location');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
            updateQueued = false;
        }

        function queueCurrentLinkUpdate() {
            if (!updateQueued) {
                updateQueued = true;
                requestAnimationFrame(syncCurrentLink);
            }
        }

        window.addEventListener('scroll', queueCurrentLinkUpdate, { passive: true });
        window.addEventListener('resize', queueCurrentLinkUpdate);
        window.addEventListener('hashchange', queueCurrentLinkUpdate);
        window.addEventListener('load', queueCurrentLinkUpdate);
        window.addEventListener('pageshow', queueCurrentLinkUpdate);
        queueCurrentLinkUpdate();

        function drawCurve(amount) {
            curves.forEach(function (curve) { updateCurve(curve, amount); });
        }

        function updateCurve(curve, amount) {
            curve.amount = amount;
            curve.path.setAttribute('d', 'M100 0 L200 0 L200 1000 L100 1000 Q' + (-100 + amount * 200) + ' 500 100 0');
        }

        function animateCurve(open) {
            cancelAnimationFrame(curveFrame);
            const target = open ? 1 : 0;
            if (reducedMotion.matches || !mobile.matches) {
                drawCurve(target);
                return;
            }
            const starts = curves.map(function (curve) { return curve.amount; });
            const started = performance.now();
            function frame(now) {
                let finished = true;
                curves.forEach(function (curve, index) {
                    // Зелёный край ведёт при открытии, кремовый догоняет его.
                    const delay = open ? index * 140 : (1 - index) * 100;
                    const duration = open ? 860 : 550;
                    const progress = Math.max(0, Math.min((now - started - delay) / duration, 1));
                    const eased = progress * progress * (3 - 2 * progress);
                    updateCurve(curve, starts[index] + (target - starts[index]) * eased);
                    if (progress < 1) finished = false;
                });
                if (!finished) curveFrame = requestAnimationFrame(frame);
            }
            curveFrame = requestAnimationFrame(frame);
        }

        function setMenu(open, restoreFocus) {
            open = open && mobile.matches;
            const changed = open !== menuOpen;
            menuOpen = open;
            if (changed && open) {
                // Keep content width unchanged when a classic scrollbar disappears.
                const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
                originalBodyPadding = document.body.style.paddingRight;
                if (scrollbarWidth > 0) {
                    document.body.style.paddingRight = (parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarWidth) + 'px';
                }
            } else if (!open && originalBodyPadding !== null) {
                document.body.style.paddingRight = originalBodyPadding;
                originalBodyPadding = null;
            }
            header.classList.toggle('header--menu-open', open);
            document.body.classList.toggle('menu-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
            shell.inert = mobile.matches && !open;

            if (open) {
                header.setAttribute('role', 'dialog');
                header.setAttribute('aria-modal', 'true');
                header.setAttribute('aria-label', 'Навигация MIX');
                if (changed) {
                    const background = Array.from(document.body.children).filter(function (element) {
                        return element !== header && !['SCRIPT', 'STYLE'].includes(element.tagName);
                    }).concat([header.querySelector('.header__logo-link'), header.querySelector('.header__button')]);
                    background.forEach(function (element) {
                        inertElements.set(element, element.inert);
                        element.inert = true;
                    });
                    links[0].focus({ preventScroll: true });
                }
            } else {
                header.removeAttribute('role');
                header.removeAttribute('aria-modal');
                header.removeAttribute('aria-label');
                inertElements.forEach(function (inert, element) { element.inert = inert; });
                inertElements.clear();
            }

            if (changed) animateCurve(open);

            if (restoreFocus) {
                toggle.focus({ preventScroll: true });
            }
        }

        toggle.addEventListener('click', function () {
            setMenu(!menuOpen, false);
        });

        navigation.addEventListener('click', function (event) {
            const link = event.target.closest('a');

            if (link && mobile.matches) {
                setMenu(false, false);
                const destination = document.getElementById(link.hash.slice(1));
                if (destination) {
                    if (destination.tagName === 'DETAILS') destination.open = true;
                    destination.setAttribute('tabindex', '-1');
                    destination.focus({ preventScroll: true });
                }
            }
        });

        document.addEventListener('keydown', function (event) {
            if (!menuOpen) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                setMenu(false, true);
            }
            if (event.key === 'Tab') {
                const controls = [toggle].concat(Array.from(navigation.querySelectorAll('a[href]')));
                const index = controls.indexOf(document.activeElement);
                const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
                event.preventDefault();
                controls[next].focus({ preventScroll: true });
            }
        });

        backdrop.addEventListener('click', function () { setMenu(false, true); });

        mobile.addEventListener('change', function () {
            const focusWasInside = shell.contains(document.activeElement);
            setMenu(false, false);
            cancelAnimationFrame(curveFrame);
            drawCurve(0);
            if (focusWasInside && mobile.matches) toggle.focus({ preventScroll: true });
            else if (!mobile.matches && document.activeElement === toggle) links[0].focus({ preventScroll: true });
        });
        reducedMotion.addEventListener('change', function () {
            if (reducedMotion.matches) {
                cancelAnimationFrame(curveFrame);
                drawCurve(menuOpen ? 1 : 0);
            }
        });
        window.addEventListener('pagehide', function () {
            setMenu(false, false);
            cancelAnimationFrame(curveFrame);
            drawCurve(0);
        });
        setMenu(false, false);
    }

    function initSectionLinks() {
        function revealSection(hash) {
            const section = document.getElementById(hash.slice(1));

            if (section && section.tagName === 'DETAILS') {
                section.open = true;
            }
        }

        document.addEventListener('click', function (event) {
            const link = event.target.closest('a[href^="#"]');

            if (link) {
                revealSection(link.getAttribute('href'));
            }
        });
        window.addEventListener('hashchange', function () { revealSection(window.location.hash); });
        revealSection(window.location.hash);
    }

    function initHero() {
        const hero = document.querySelector('.hero');
        const slides = Array.from(hero.querySelectorAll('.hero__slide'));
        const pause = hero.querySelector('.hero__pause');
        const status = hero.querySelector('.hero__status');
        const mobileHero = window.matchMedia('(max-width: 600px)');
        const switchPanel = createPanelSwitcher(slides, 600, 0);
        const topics = ['Паста и хорошая компания', 'Пицца для вкусных встреч', 'Время для сладкой паузы', 'Атмосфера, в которой хорошо', 'Утро начинается со вкуса'];
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        function conserveData() {
            return connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType));
        }
        let current = 0;
        let requested = 0;
        let timer = null;
        let prefetchTimer = null;
        let userPaused = false;
        let explicitPlayback = false;
        let switching = false;
        let focused = false;
        let visible = true;
        let touchStart = null;
        let request = 0;

        pause.hidden = false;

        function slideTopic(index) {
            if (mobileHero.matches && index === 0) return topics[2];
            if (mobileHero.matches && index === 2) return topics[0];
            return topics[index];
        }

        function syncSlideDescriptions() {
            const mobile = mobileHero.matches;
            slides[0].setAttribute('aria-label', '1 из 5: ' + (mobile ? 'десерт' : 'паста'));
            slides[2].setAttribute('aria-label', '3 из 5: ' + (mobile ? 'паста' : 'десерт'));
            slides[0].querySelector('img').alt = mobile ? 'Тирамису с ягодами и чашка эспрессо' : 'Паста с креветками на столе в тёплом солнечном свете';
            slides[2].querySelector('img').alt = mobile ? 'Паста с креветками на столе в тёплом солнечном свете' : 'Тирамису с ягодами и чашка эспрессо';
            status.textContent = 'Слайд ' + (current + 1) + ' из ' + slides.length + ': ' + slideTopic(current) + '.';
        }

        syncSlideDescriptions();
        mobileHero.addEventListener('change', syncSlideDescriptions);

        function syncTimer() {
            const paused = userPaused || (conserveData() && !explicitPlayback);
            pause.hidden = reducedMotion.matches;
            pause.setAttribute('aria-pressed', String(Boolean(paused)));
            pause.setAttribute('aria-label', paused ? 'Запустить слайдер' : 'Приостановить слайдер');
            pause.textContent = paused ? 'Запустить смену фото' : 'Приостановить смену фото';

            const running = !paused && !switching && !focused && visible && !document.hidden && !reducedMotion.matches;

            if (!running) {
                window.clearTimeout(timer);
                window.clearTimeout(prefetchTimer);
                timer = null;
                prefetchTimer = null;
            } else if (timer === null) {
                // Keep the next photo off the first screen's critical network path.
                prefetchTimer = window.setTimeout(function () {
                    prefetchTimer = null;
                    preloadNext();
                }, 2500);
                timer = window.setTimeout(function () {
                    timer = null;
                    showSlide(current + 1, false);
                }, 4000);
            }
        }

        function prepareSlide(index) {
            const slide = slides[index];
            slide.querySelectorAll('source[data-srcset]').forEach(function (source) {
                source.srcset = source.dataset.srcset;
                source.removeAttribute('data-srcset');
            });
            const image = slide.querySelector('img');
            image.loading = 'eager';
            if (image.dataset.srcset) {
                image.srcset = image.dataset.srcset;
                image.removeAttribute('data-srcset');
            }
            if (image.dataset.src) {
                image.src = image.dataset.src;
                image.removeAttribute('data-src');
            }
            return image.decode();
        }

        function preloadNext() {
            if ((conserveData() && !explicitPlayback) || document.hidden || !visible || userPaused || reducedMotion.matches) return;
            prepareSlide((current + 1) % slides.length).catch(function () { /* Try again on navigation. */ });
        }

        async function showSlide(index, manual) {
            const target = (index + slides.length) % slides.length;
            requested = target;
            const pending = ++request;
            switching = true;

            if (manual) {
                userPaused = true;
            }
            syncTimer();

            try {
                await prepareSlide(target);

                if (pending !== request) {
                    return;
                }

                current = requested = target;
                switchPanel(target);
                status.setAttribute('aria-live', manual ? 'polite' : 'off');
                status.textContent = 'Слайд ' + (target + 1) + ' из ' + slides.length + ': ' + slideTopic(target) + '.';
            } catch (error) {
                // При ошибке загрузки сохраняем предыдущую фотографию.
                if (pending === request) requested = current;
            } finally {
                if (pending === request) {
                    switching = false;
                    syncTimer();
                }
            }
        }

        pause.addEventListener('click', function () {
            if (conserveData() && !explicitPlayback) {
                explicitPlayback = true;
                userPaused = false;
            } else {
                userPaused = !userPaused;
            }
            syncTimer();
        });

        hero.addEventListener('keydown', function (event) {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            const keys = { ArrowLeft: requested - 1, ArrowRight: requested + 1, Home: 0, End: slides.length - 1 };

            if (Object.hasOwn(keys, event.key)) {
                event.preventDefault();
                showSlide(keys[event.key], true);
            }
        });

        hero.addEventListener('focusin', function () { focused = true; syncTimer(); });
        hero.addEventListener('focusout', function (event) {
            focused = hero.contains(event.relatedTarget);
            syncTimer();
        });

        hero.querySelector('.hero__media').addEventListener('pointerdown', function (event) {
            if (event.pointerType === 'touch') {
                touchStart = { x: event.clientX, y: event.clientY };
            }
        });

        hero.addEventListener('pointerup', function (event) {
            if (touchStart) {
                const deltaX = event.clientX - touchStart.x;
                const deltaY = event.clientY - touchStart.y;

                if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                    showSlide(current + (deltaX < 0 ? 1 : -1), true);
                }

                touchStart = null;
            }
        });

        hero.addEventListener('pointercancel', function () { touchStart = null; });
        reducedMotion.addEventListener('change', syncTimer);
        document.addEventListener('visibilitychange', syncTimer);
        window.addEventListener('pageshow', syncTimer);
        window.addEventListener('pagehide', function () {
            window.clearTimeout(timer);
            window.clearTimeout(prefetchTimer);
            timer = prefetchTimer = null;
        });
        if (connection && connection.addEventListener) connection.addEventListener('change', syncTimer);

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                syncTimer();
            }, { threshold: 0.15 }).observe(hero);
        }

        syncTimer();
    }

    function initAdvantages() {
        const section = document.querySelector('.advantages');
        const track = section.querySelector('.advantages__list');
        const cards = Array.from(track.children);
        const controls = section.querySelector('.advantages__controls');
        const previous = controls.querySelector('[data-advantages-step="-1"]');
        const next = controls.querySelector('[data-advantages-step="1"]');
        const status = section.querySelector('#advantages-status');
        const mobile = window.matchMedia('(max-width: 600px)');
        let destination = null;
        let queued = false;

        function update() {
            queued = false;
            controls.hidden = !mobile.matches;
            previous.disabled = track.scrollLeft <= 2;
            next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
            if (!mobile.matches || (destination !== null && Math.abs(track.scrollLeft - destination) < 2)) {
                destination = null;
            }
        }

        function queueUpdate() {
            if (!queued) {
                queued = true;
                requestAnimationFrame(update);
            }
        }

        controls.addEventListener('click', function (event) {
            const button = event.target.closest('[data-advantages-step]');
            if (!mobile.matches || !button || button.disabled) return;
            const step = cards[1].offsetLeft - cards[0].offsetLeft;
            const base = destination === null ? track.scrollLeft : destination;
            const index = Math.max(0, Math.min(cards.length - 1, Math.round(base / step) + Number(button.dataset.advantagesStep)));
            destination = Math.max(0, Math.min(track.scrollWidth - track.clientWidth, index * step));
            track.scrollTo({left: destination, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
            status.textContent = cards[index].querySelector('.advantages__title').innerText.replace(/\s+/g, ' ') +
                '. Карточка ' + (index + 1) + ' из ' + cards.length;
            queueUpdate();
        });

        track.addEventListener('scroll', queueUpdate, {passive: true});
        track.addEventListener('pointerdown', function () { destination = null; }, {passive: true});
        track.addEventListener('wheel', function () { destination = null; }, {passive: true});
        window.addEventListener('resize', function () { destination = null; queueUpdate(); });
        mobile.addEventListener('change', update);
        reducedMotion.addEventListener('change', function () {
            if (reducedMotion.matches && destination !== null) track.scrollTo({left: destination, behavior: 'instant'});
        });
        update();
    }

    function initOrder() {
        const order = window.MixOrder;
        const form = document.querySelector('.order-form');
        const dish = form.elements.namedItem('dish');
        const quantity = form.elements.namedItem('quantity');
        const quantityField = document.querySelector('#quantity-field');
        const fulfillment = document.querySelector('#fulfillment-field');
        const address = document.querySelector('#address-field');
        const summary = document.querySelector('#order-summary');
        const feedback = document.querySelector('#form-feedback');
        const download = document.querySelector('#download-request');
        let preparedRequest = null;

        function getDraft() {
            return Object.fromEntries(new FormData(form).entries());
        }

        function clearError(name) {
            const field = form.elements.namedItem(name);
            const error = form.querySelector('[data-error="' + name + '"]');

            if (field && field.classList) {
                field.classList.remove('order-form__input--invalid');
                field.removeAttribute('aria-invalid');
            }

            if (error) {
                error.textContent = '';
            }
        }

        function invalidateRequest() {
            preparedRequest = null;
            feedback.hidden = true;
            download.hidden = true;
        }

        function updateChoice() {
            const selected = Boolean(dish.value);
            const delivery = selected && form.elements.namedItem('fulfillment').value === 'delivery';
            quantityField.hidden = !selected;
            quantityField.parentElement.classList.toggle('order-form__row--single', !selected);
            quantity.disabled = !selected;
            fulfillment.hidden = !selected;
            fulfillment.disabled = !selected;
            address.hidden = !delivery;
            address.disabled = !delivery;
            form.elements.namedItem('city').required = delivery;
            form.elements.namedItem('address').required = delivery;
            summary.hidden = !selected;

            if (selected) {
                const total = order.getTotal(dish.value, quantity.value);
                summary.textContent = total === null ? 'Укажите количество от 1 до 20.' : 'Стоимость блюд: ' + total.toLocaleString('ru-RU') + ' ₽' + (delivery ? ' · без стоимости доставки' : ' · самовывоз');
            }

            ['quantity', 'city', 'address'].forEach(clearError);
        }

        form.querySelector('.order-form__submit').disabled = false;

        document.querySelectorAll('.dish__button').forEach(function (button) {
            button.hidden = false;
            button.addEventListener('click', function () {
                dish.value = button.dataset.dish;
                quantity.value = '1';
                invalidateRequest();
                updateChoice();
                document.querySelector('#contactForm').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
                form.elements.namedItem('name').focus({ preventScroll: true });
            });
        });

        document.querySelectorAll('.header__button, .footer__button').forEach(function (link) {
            link.addEventListener('click', function () {
                dish.value = '';
                invalidateRequest();
                updateChoice();
            });
        });

        form.addEventListener('input', function (event) {
            invalidateRequest();

            if (event.target.name) {
                clearError(event.target.name);
            }

            if (event.target === quantity) {
                updateChoice();
            }
        });

        form.addEventListener('change', function () {
            invalidateRequest();
            updateChoice();
        });

        const phoneInput = form.elements.namedItem('phone');
        phoneInput.addEventListener('input', function () {
            const raw = phoneInput.value;
            const caret = phoneInput.selectionStart;
            const before = raw.slice(0, caret).replace(/\D/g, '').length;
            const country = /^[78]/.test(raw.replace(/\D/g, ''));
            const formatted = order.formatPhoneInput(raw);
            if (formatted === raw) return;
            phoneInput.value = formatted;
            if (caret === raw.length) {
                phoneInput.setSelectionRange(formatted.length, formatted.length);
                return;
            }
            const count = before + (country ? 0 : 1);
            const positions = Array.from(formatted.matchAll(/\d/g));
            const next = count > 0 && positions[count - 1] ? positions[count - 1].index + 1 : 0;
            phoneInput.setSelectionRange(next, next);
        });

        phoneInput.addEventListener('beforeinput', function (event) {
            if (!/^deleteContent(Backward|Forward)$/.test(event.inputType) ||
                phoneInput.selectionStart !== phoneInput.selectionEnd ||
                !phoneInput.value.startsWith('+7')) return;
            const caret = phoneInput.selectionStart;
            const digits = Array.from(phoneInput.value.matchAll(/\d/g)).slice(1);
            const backwards = event.inputType === 'deleteContentBackward';
            const digit = backwards ? digits.reverse().find(function (match) { return match.index < caret; }) :
                digits.find(function (match) { return match.index >= caret; });
            event.preventDefault();
            if (!digit) {
                if (backwards && digits.length === 0) {
                    phoneInput.value = '';
                    phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return;
            }
            phoneInput.value = phoneInput.value.slice(0, digit.index) + phoneInput.value.slice(digit.index + 1);
            phoneInput.setSelectionRange(digit.index, digit.index);
            phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        });

        phoneInput.addEventListener('blur', function (event) {
            const value = event.target.value;
            event.target.value = value.replace(/\D/g, '') === '7' ? '' : order.formatPhone(value);
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            invalidateRequest();
            form.querySelectorAll('[data-error]').forEach(function (error) { clearError(error.dataset.error); });

            const draft = getDraft();
            const errors = order.validateDraft(draft);
            const names = Object.keys(errors);

            feedback.hidden = false;
            feedback.classList.toggle('order-form__feedback--error', names.length > 0);

            if (names.length) {
                names.forEach(function (name) {
                    const field = form.elements.namedItem(name);
                    const error = form.querySelector('[data-error="' + name + '"]');

                    if (field && field.classList) {
                        field.classList.add('order-form__input--invalid');
                        field.setAttribute('aria-invalid', 'true');
                    }

                    if (error) {
                        error.textContent = errors[name];
                    }
                });

                feedback.textContent = 'Проверьте данные. ' + Object.values(errors).join(' ');
                const first = form.elements.namedItem(names[0]);

                if (first && typeof first.focus === 'function') {
                    first.focus();
                }

                return;
            }

            preparedRequest = order.createRequest(draft);
            feedback.textContent = 'Текст заявки готов. Скачайте его, чтобы передать в кафе.';
            download.hidden = false;
        });

        download.addEventListener('click', function () {
            if (!preparedRequest) {
                return;
            }

            const url = URL.createObjectURL(new Blob(['\uFEFF' + preparedRequest], { type: 'text/plain;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'mix-request.txt';
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });

        updateChoice();
    }

    function initMap() {
        const button = document.querySelector('#load-map');
        const frame = document.querySelector('#contact-map');
        const status = document.querySelector('#map-loading');
        button.hidden = false;

        let loaded = false;

        function loadMap(focus) {
            if (loaded) {
                return;
            }

            loaded = true;
            frame.src = frame.dataset.src;
            frame.hidden = false;
            status.hidden = false;
            document.querySelector('#map-placeholder').hidden = true;
            if (focus) {
                frame.focus();
            }
        }

        button.addEventListener('click', function () { loadMap(true); });

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(function (entries) {
                if (entries[0].isIntersecting) {
                    loadMap(false);
                    observer.disconnect();
                }
            }, { rootMargin: '600px' });
            observer.observe(document.querySelector('.contact__map'));
        } else {
            loadMap(false);
        }

        frame.addEventListener('load', function () {
            if (loaded) status.textContent = 'Карта загружена.';
        });
    }

    function initBackTop() {
        const button = document.querySelector('.back-top');
        let queued = false;

        function update() {
            button.hidden = window.scrollY < 700;
            queued = false;
        }

        window.addEventListener('scroll', function () {
            if (!queued) {
                queued = true;
                window.requestAnimationFrame(update);
            }
        }, { passive: true });
        update();
    }

    function loadWhenNear(selector, source) {
        const section = document.querySelector(selector);
        if (!section) return;
        let started = false;
        let observer;
        function load() {
            if (started) return;
            started = true;
            if (observer) observer.disconnect();
            const script = document.createElement('script');
            script.src = source;
            script.async = true;
            script.fetchPriority = 'low';
            document.head.append(script);
        }
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(function (entries) {
                if (entries[0].isIntersecting) load();
            }, { rootMargin: '600px' });
            observer.observe(section);
            section.addEventListener('focusin', load, { once: true });
        } else {
            load();
        }
    }

    initNavigation();
    initSectionLinks();
    initHero();
    initAdvantages();
    initOrder();
    initMap();
    initBackTop();
    initMotion();
    loadWhenNear('.photo-window', 'js/photo-window.js?v=03e4c71b91');
    loadWhenNear('.favorite', 'js/favorites.js?v=371ab3e6a5');
})();
