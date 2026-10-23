/* Данные исходного меню и проверка заявки. Никаких сетевых отправок. */
(function (root) {
    'use strict';

    const dishes = Object.freeze({
        soup: Object.freeze({ name: 'Солянка мясная', price: 159, mass: '360/20/50 г' }),
        salad: Object.freeze({ name: 'Салат Витаминка', price: 209, mass: '250/20 г' }),
        pizza: Object.freeze({ name: 'Пицца Острый перчик', price: 709, mass: '480 г' }),
        pasta: Object.freeze({ name: 'Паста с креветками', price: 489, mass: '320 г' }),
        chicken: Object.freeze({ name: 'Цыплёнок с картофелем', price: 459, mass: '330 г' }),
        risotto: Object.freeze({ name: 'Ризотто с грибами', price: 389, mass: '300 г' }),
        cheesecake: Object.freeze({ name: 'Чизкейк с ягодами', price: 279, mass: '160 г' })
    });

    function normalizePhone(value) {
        const phone = String(value || '').trim();

        if (!/^\+?[\d\s().-]+$/.test(phone)) {
            return null;
        }

        let digits = phone.replace(/\D/g, '');

        if (digits.length === 10) {
            digits = '7' + digits;
        }

        if (digits.length === 11 && digits.startsWith('8')) {
            digits = '7' + digits.slice(1);
        }

        return /^7\d{10}$/.test(digits) ? '+' + digits : null;
    }

    function formatPhone(value) {
        const phone = normalizePhone(value);

        if (!phone) {
            return value;
        }

        return phone.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 ($1) $2-$3-$4');
    }

    function formatPhoneInput(value) {
        const text = String(value || '');
        let digits = text.replace(/\D/g, '');
        // Leave an explicitly foreign country code for the existing validator.
        if (/^\s*\+/.test(text) && !/^[78]/.test(digits)) return text;
        const hasCountry = /^[78]/.test(digits);
        if (hasCountry) digits = digits.slice(1);
        digits = digits.slice(0, 10);
        if (!digits) return hasCountry ? '+7 (' : '';
        let formatted = '+7 (' + digits.slice(0, 3);
        if (digits.length >= 3) formatted += ')';
        if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
        if (digits.length > 6) formatted += '-' + digits.slice(6, 8);
        if (digits.length > 8) formatted += '-' + digits.slice(8, 10);
        return formatted;
    }

    function validateDraft(draft) {
        const errors = {};
        const name = String(draft.name || '').trim();

        if (name.length < 2 || name.length > 80) {
            errors.name = 'Введите имя: от 2 до 80 символов.';
        }

        if (!normalizePhone(draft.phone)) {
            errors.phone = 'Введите российский номер из 11 цифр с 7 или 8, либо 10 цифр без кода.';
        }

        if (draft.consent !== 'yes') {
            errors.consent = 'Подтвердите согласие на обработку данных.';
        }

        if (draft.dish && !Object.hasOwn(dishes, draft.dish)) {
            errors.dish = 'Выберите блюдо из меню.';
        }

        if (draft.dish) {
            const quantity = Number(draft.quantity);

            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
                errors.quantity = 'Укажите целое количество от 1 до 20.';
            }

            if (!['pickup', 'delivery'].includes(draft.fulfillment)) {
                errors.fulfillment = 'Выберите самовывоз или доставку.';
            }

            if (draft.fulfillment === 'delivery') {
                if (!String(draft.city || '').trim() || String(draft.city).length > 80) {
                    errors.city = 'Укажите город доставки.';
                }

                if (String(draft.address || '').trim().length < 4 || String(draft.address).length > 180) {
                    errors.address = 'Укажите улицу и номер дома.';
                }
            }
        }

        if (String(draft.comment || '').length > 1000) {
            errors.comment = 'Сократите комментарий до 1000 символов.';
        }

        return errors;
    }

    function getTotal(dish, quantity) {
        const count = Number(quantity);

        if (!Object.hasOwn(dishes, dish) || !Number.isInteger(count) || count < 1 || count > 20) {
            return null;
        }

        return dishes[dish].price * count;
    }

    function createRequest(draft) {
        if (Object.keys(validateDraft(draft)).length) {
            throw new Error('Нельзя подготовить заявку с ошибками.');
        }

        const lines = [
            'MIX — текст заявки',
            'Для передачи в кафе.',
            '',
            'Имя: ' + String(draft.name).trim(),
            'Телефон: ' + normalizePhone(draft.phone)
        ];

        if (draft.dish) {
            const dish = dishes[draft.dish];
            lines.push(
                'Блюдо: ' + dish.name,
                'Вес одной порции: ' + dish.mass,
                'Количество: ' + Number(draft.quantity),
                'Стоимость блюд: ' + getTotal(draft.dish, draft.quantity) + ' ₽',
                'Получение: ' + (draft.fulfillment === 'delivery' ? 'Доставка (стоимость не рассчитана)' : 'Самовывоз')
            );

            if (draft.fulfillment === 'delivery') {
                lines.push('Адрес: ' + String(draft.city).trim() + ', ' + String(draft.address).trim());

                [['apartment', 'Квартира'], ['entrance', 'Подъезд'], ['floor', 'Этаж']].forEach(function (field) {
                    if (String(draft[field[0]] || '').trim()) {
                        lines.push(field[1] + ': ' + String(draft[field[0]]).trim());
                    }
                });
            }
        } else {
            lines.push('Запрос: обратный звонок');
        }

        if (String(draft.comment || '').trim()) {
            lines.push('Комментарий: ' + String(draft.comment).trim());
        }

        return lines.join('\n');
    }

    const api = Object.freeze({ dishes, normalizePhone, formatPhone, formatPhoneInput, validateDraft, getTotal, createRequest });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.MixOrder = api;
    }
})(globalThis);
