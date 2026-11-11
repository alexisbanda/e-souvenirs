import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import OrderCustomerInfo, { formatCustomerAddress, phoneHref } from './OrderCustomerInfo';

const conTodo = { name: 'Ada', email: 'ada@example.com', phone: '0991234567', address: 'Av. X', city: 'Quito', postalCode: '170150' };
const pedidoAntiguoSinDatos = { name: 'Bob', email: 'bob@example.com', address: 'Av. X', city: 'Quito' };

describe('OrderCustomerInfo', () => {
    it('muestra el teléfono como enlace tel: y la dirección completa', () => {
        const html = renderToStaticMarkup(<OrderCustomerInfo customer={conTodo} />);

        expect(html).toContain('Teléfono:');
        expect(html).toContain('href="tel:0991234567"');
        expect(html).toContain('Av. X, Quito, 170150');
    });

    it('un pedido sin teléfono ni código postal no rompe ni deja comas colgando', () => {
        const html = renderToStaticMarkup(<OrderCustomerInfo customer={pedidoAntiguoSinDatos} />);

        expect(html).not.toContain('Teléfono:');
        expect(html).not.toContain('tel:');
        expect(html).toContain('Av. X, Quito</p>');
        expect(html).not.toContain(', ,');
        expect(html).not.toMatch(/,\s*<\/p>/);
    });

    it('quita los espacios del número en el href', () => {
        expect(phoneHref('+593 99 123 4567')).toBe('tel:+593991234567');
    });

    it.each([
        [{ ...pedidoAntiguoSinDatos, postalCode: '' }, 'Av. X, Quito'],
        [{ ...pedidoAntiguoSinDatos, address: '', postalCode: '170150' }, 'Quito, 170150'],
        [{ ...pedidoAntiguoSinDatos, city: '  ' }, 'Av. X'],
    ])('formatCustomerAddress une solo las partes no vacías (%#)', (customer, expected) => {
        expect(formatCustomerAddress(customer)).toBe(expected);
    });
});
