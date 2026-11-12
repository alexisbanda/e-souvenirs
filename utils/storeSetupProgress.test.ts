import { describe, expect, it } from 'vitest';

import { computeSetupProgress } from './storeSetupProgress';
import { defaultHeroImages } from './constants';
import type { Company } from '../types/company';
import type { Category, Product } from '../types';
import type { ShippingMethod } from '../services/shippingService';

const baseCompany = (overrides: Partial<Company> = {}): Company => ({
    id: 'c1',
    name: 'Tienda',
    contact: { email: 'a@a.com' },
    settings: { allowCustomizations: false, enableAIAssistant: false },
    slug: 'tienda',
    status: 'APPROVED',
    ...overrides,
} as Company);

describe('computeSetupProgress', () => {
    it('tienda recién registrada -> 0 de 4', () => {
        const company = baseCompany();
        const categories: Category[] = [
            { id: 'cat1', name: 'General', icon: 'icon', companyId: 'c1', image: defaultHeroImages[0] },
        ];
        const products: Product[] = [
            {
                id: 'p1',
                name: 'Producto de ejemplo',
                description: 'desc',
                price: 100,
                category: 'General',
                images: [defaultHeroImages[0]],
                companyId: 'c1',
            },
        ];
        const shippingMethods: ShippingMethod[] = [];

        const progress = computeSetupProgress({ company, categories, products, shippingMethods });

        expect(progress.completed).toBe(0);
        expect(progress.total).toBe(4);
        expect(progress.steps).toEqual([
            { key: 'store', done: false },
            { key: 'categories', done: false },
            { key: 'products', done: false },
            { key: 'shipping', done: false },
        ]);
    });

    it('logo+teléfono y categoría propia, sin productos propios ni envíos -> 2 de 4', () => {
        const company = baseCompany({ logo: 'logo.png', phone: '555-1234' });
        const categories: Category[] = [
            { id: 'cat1', name: 'Tazas', icon: 'icon', companyId: 'c1', image: 'https://cdn.example.com/tazas.jpg' },
        ];
        const products: Product[] = [
            {
                id: 'p1',
                name: 'Producto de ejemplo',
                description: 'desc',
                price: 100,
                category: 'Tazas',
                images: [defaultHeroImages[0]],
                companyId: 'c1',
            },
        ];
        const shippingMethods: ShippingMethod[] = [];

        const progress = computeSetupProgress({ company, categories, products, shippingMethods });

        expect(progress.completed).toBe(2);
        expect(progress.steps).toEqual([
            { key: 'store', done: true },
            { key: 'categories', done: true },
            { key: 'products', done: false },
            { key: 'shipping', done: false },
        ]);
    });

    it('todo completo -> 4 de 4', () => {
        const company = baseCompany({ logo: 'logo.png', phone: '555-1234' });
        const categories: Category[] = [
            { id: 'cat1', name: 'Tazas', icon: 'icon', companyId: 'c1', image: 'https://cdn.example.com/tazas.jpg' },
        ];
        const products: Product[] = [
            {
                id: 'p1',
                name: 'Taza personalizada',
                description: 'desc',
                price: 120,
                category: 'Tazas',
                images: ['https://cdn.example.com/taza-propia.jpg'],
                companyId: 'c1',
            },
        ];
        const shippingMethods: ShippingMethod[] = [
            { id: 's1', name: 'Entrega local', price: 5, companyId: 'c1' },
        ];

        const progress = computeSetupProgress({ company, categories, products, shippingMethods });

        expect(progress.completed).toBe(4);
        expect(progress.steps.every((step) => step.done)).toBe(true);
    });

    it('whatsapp en lugar de phone también vale para el paso de la tienda', () => {
        const company = baseCompany({
            logo: 'logo.png',
            settings: { allowCustomizations: false, enableAIAssistant: false, whatsapp: '+593999999' },
        });

        const progress = computeSetupProgress({
            company,
            categories: [],
            products: [],
            shippingMethods: [],
        });

        expect(progress.steps[0]).toEqual({ key: 'store', done: true });
    });

    it('logo sin contacto no vale para el paso de la tienda', () => {
        const company = baseCompany({ logo: 'logo.png' });

        const progress = computeSetupProgress({
            company,
            categories: [],
            products: [],
            shippingMethods: [],
        });

        expect(progress.steps[0]).toEqual({ key: 'store', done: false });
    });
});
