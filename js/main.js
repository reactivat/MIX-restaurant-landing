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
                if (entry.target.classList.contains('dish')) {
                    const index = Array.from(entry.target.parentElement.children).indexOf(entry.target);
                    const delay = window.matchMedia('(min-width: 801px)').matches ? index * 65 : 0;
                    animateEntrance(entry.target, delay, 20);
                } else {
                    animateEntrance(entry.target, 0, 18);
                }
            });
        }, { threshold: 0.08 });

        document.querySelectorAll('.hero__content, .advantages__list, .about__content, .about__figure, .favorite__header, .dish, .order, .reviews__header, .contact__info').forEach(function (element) {
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
        const curve = header.querySelector('.header__curve path');
        const links = Array.from(navigation.querySelectorAll('.header__nav-link[href^="#"]'));
        const sections = links.map(function (link) {
            return { link: link, target: document.getElementById(link.hash.slice(1)) };
        }).filter(function (section) { return section.target; });
        let updateQueued = false;
        let menuOpen = false;
        let curveFrame = 0;
        let curveAmount = 0;
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
        queueCurrentLinkUpdate();

        function drawCurve(amount) {
            curveAmount = amount;
            curve.setAttribute('d', 'M100 0 L200 0 L200 1000 L100 1000 Q' + (-100 + amount * 200) + ' 500 100 0');
        }

        function animateCurve(open) {
            cancelAnimationFrame(curveFrame);
            const target = open ? 1 : 0;
            if (reducedMotion.matches || !mobile.matches) {
                drawCurve(target);
                return;
            }
            const start = curveAmount;
            const started = performance.now();
            const duration = open ? 1000 : 550;
            function frame(now) {
                const progress = Math.min((now - started) / duration, 1);
                const eased = progress * progress * (3 - 2 * progress);
                drawCurve(start + (target - start) * eased);
                if (progress < 1) curveFrame = requestAnimationFrame(frame);
            }
            curveFrame = requestAnimationFrame(frame);
        }

        function setMenu(open, restoreFocus) {
            open = open && mobile.matches;
            const changed = open !== menuOpen;
            menuOpen = open;
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
        const switchPanel = createPanelSwitcher(slides, 600, 0);
        const topics = ['Паста и хорошая компания', 'Пицца для вкусных встреч', 'Время для сладкой паузы', 'Атмосфера, в которой хорошо', 'Утро начинается со вкуса'];
        let current = 0;
        let timer = null;
        let userPaused = false;
        let switching = false;
        let focused = false;
        let visible = true;
        let touchStart = null;
        let request = 0;

        pause.hidden = false;

        function syncTimer() {
            pause.hidden = reducedMotion.matches;
            pause.setAttribute('aria-pressed', String(userPaused));
            pause.setAttribute('aria-label', userPaused ? 'Запустить слайдер' : 'Приостановить слайдер');
            pause.textContent = userPaused ? 'Запустить смену фото' : 'Приостановить смену фото';

            const running = !userPaused && !switching && !focused && visible && !document.hidden && !reducedMotion.matches;

            if (!running) {
                window.clearTimeout(timer);
                timer = null;
            } else if (timer === null) {
                timer = window.setTimeout(function () {
                    timer = null;
                    showSlide(current + 1, false);
                }, 4000);
            }
        }

        function preloadNext() {
            const image = slides[(current + 1) % slides.length].querySelector('img');
            image.loading = 'eager';
            image.decode().catch(function () { /* Повторная попытка будет при переключении. */ });
        }

        async function showSlide(index, manual) {
            current = (index + slides.length) % slides.length;
            const target = current;
            const pending = ++request;
            const image = slides[target].querySelector('img');
            image.loading = 'eager';
            switching = true;

            if (manual) {
                userPaused = true;
            }
            syncTimer();

            try {
                await image.decode();

                if (pending !== request) {
                    return;
                }

                switchPanel(target);
                status.setAttribute('aria-live', manual ? 'polite' : 'off');
                status.textContent = 'Слайд ' + (target + 1) + ' из ' + slides.length + ': ' + topics[target] + '.';
                preloadNext();
            } catch (error) {
                // При ошибке загрузки сохраняем предыдущую фотографию.
            } finally {
                if (pending === request) {
                    switching = false;
                    syncTimer();
                }
            }
        }

        pause.addEventListener('click', function () {
            userPaused = !userPaused;
            syncTimer();
        });

        hero.addEventListener('keydown', function (event) {
            const keys = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: slides.length - 1 };

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

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                syncTimer();
            }, { threshold: 0.15 }).observe(hero);
        }

        slides[0].querySelector('img').decode().then(preloadNext, preloadNext);
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
            });
            observer.observe(document.querySelector('.contact__map'));
        }

        frame.addEventListener('load', function () {
            status.textContent = 'Карта загружена.';
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

    initNavigation();
    initSectionLinks();
    initHero();
    initAdvantages();
    initOrder();
    initMap();
    initBackTop();
    initMotion();
})();
