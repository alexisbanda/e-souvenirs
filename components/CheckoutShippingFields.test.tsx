import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import CheckoutShippingFields, { EMPTY_SHIPPING_INFO } from './CheckoutShippingFields';

const render = () => renderToStaticMarkup(<CheckoutShippingFields value={EMPTY_SHIPPING_INFO} onChange={() => {}} />);

const inputTag = (html: string, name: string) => {
    const match = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
    expect(match, `input ${name}`).not.toBeNull();
    return match![0];
};

describe('CheckoutShippingFields', () => {
    it('pide el teléfono como campo tel obligatorio con autocompletado', () => {
        const phone = inputTag(render(), 'phone');

        expect(phone).toContain('type="tel"');
        expect(phone).toContain(' required=""');
        expect(phone).toContain('autoComplete="tel"');
        expect(phone).toContain('placeholder="checkout.phone_label"');
    });

    it('valida el formato del teléfono con un pattern válido para la bandera v y explica el formato en el title', () => {
        const phone = inputTag(render(), 'phone');
        expect(phone).toContain('title="checkout.phone_hint"');

        const patternMatch = phone.match(/pattern="([^"]*)"/);
        expect(patternMatch, 'atributo pattern').not.toBeNull();
        const pattern = patternMatch![1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'");

        // La bandera 'v' exige escapar '(' y ')' dentro de la clase de caracteres;
        // si el pattern no compila con ella, el navegador lo ignora en silencio.
        const regex = new RegExp(`^(?:${pattern})$`, 'v');
        expect(regex.test('0991234567')).toBe(true);
        expect(regex.test('+593 (99) 123-4567')).toBe(true);
        expect(regex.test('09912abc45')).toBe(false);
        expect(regex.test('12345')).toBe(false);
    });

    it('deja el código postal opcional y lo indica en el placeholder', () => {
        const postalCode = inputTag(render(), 'postalCode');

        expect(postalCode).not.toContain('required');
        expect(postalCode).toContain('placeholder="checkout.postal_code_optional_label"');
    });

    it.each(['name', 'email', 'address', 'city'])('mantiene %s como obligatorio', (name) => {
        expect(inputTag(render(), name)).toContain(' required=""');
    });
});

describe('traducciones del checkout en es.json y en.json', () => {
    const readLocale = (file: string) =>
        JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'public', 'locales', file), 'utf-8'));

    it.each(['es.json', 'en.json'])('%s tiene phone_label y postal_code_optional_label, no vacías', (file) => {
        const { checkout } = readLocale(file);

        expect(checkout.phone_label).toEqual(expect.any(String));
        expect(checkout.phone_label.trim()).not.toBe('');
        expect(checkout.postal_code_optional_label).toEqual(expect.any(String));
        expect(checkout.postal_code_optional_label.trim()).not.toBe('');
    });

    it.each(['es.json', 'en.json'])('%s no tiene la clave sin uso postal_code_label', (file) => {
        const { checkout } = readLocale(file);

        expect(checkout.postal_code_label).toBeUndefined();
    });
});
