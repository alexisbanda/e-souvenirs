import { describe, expect, it } from 'vitest';
import { formatOrderNumber, orderMatchesSearch } from './orderNumber';

describe('formatOrderNumber', () => {
    it('toma los 8 primeros caracteres del id en mayúsculas', () => {
        expect(formatOrderNumber('7f3K2a9qXYZ123')).toBe('7F3K2A9Q');
    });
});

describe('orderMatchesSearch', () => {
    const order = { id: '7f3K2a9qXYZ123', customer: { name: 'Ana Pérez', email: 'ana@example.com' } };

    it('encuentra por el número visible en mayúsculas', () => {
        expect(orderMatchesSearch(order, '7F3K2A9Q')).toBe(true);
    });

    it('encuentra por el número visible en minúsculas', () => {
        expect(orderMatchesSearch(order, '7f3k2a9q')).toBe(true);
    });

    it('encuentra por nombre', () => {
        expect(orderMatchesSearch(order, 'ana pérez')).toBe(true);
    });

    it('encuentra por email', () => {
        expect(orderMatchesSearch(order, 'ana@example.com')).toBe(true);
    });

    it('encuentra por id completo o parcial', () => {
        expect(orderMatchesSearch(order, '7f3K2a9qXYZ')).toBe(true);
    });

    it('no encuentra algo que no coincide', () => {
        expect(orderMatchesSearch(order, 'nada-que-ver')).toBe(false);
    });

    it('término vacío encuentra siempre', () => {
        expect(orderMatchesSearch(order, '')).toBe(true);
    });
});
