import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/firebase', () => ({ auth: {}, db: {}, storage: {} }));
vi.mock('../services/companyService', () => ({ getCompany: vi.fn() }));
vi.mock('../services/categoryService', () => ({ getCategories: vi.fn() }));
vi.mock('../services/productService', () => ({ getProducts: vi.fn() }));
vi.mock('../services/shippingService', () => ({ getShippingMethods: vi.fn() }));

import {
    loadSetupData,
    PendingApprovalNotice,
    shouldLoadSetupData,
    shouldShowPendingNotice,
    shouldShowSetupGuide,
    type SetupServices,
} from './AdminLayout';
import { computeSetupProgress } from '../utils/storeSetupProgress';
import { defaultHeroImages } from '../utils/constants';
import type { Company } from '../types/company';
import type { Category, Product } from '../types';
import type { ShippingMethod } from '../services/shippingService';

const baseCompany: Company = {
    id: 'c1',
    name: 'Tienda',
    contact: { email: 'a@a.com' },
    settings: { allowCustomizations: false, enableAIAssistant: false },
    slug: 'tienda',
    status: 'APPROVED',
};

describe('shouldShowPendingNotice', () => {
    it.each(['APPROVED', 'ACTIVE'] as const)(
        'companyadmin con empresa %s no debe ver el aviso',
        (status) => {
            expect(shouldShowPendingNotice('companyadmin', status)).toBe(false);
        },
    );

    it('companyadmin con empresa PENDING debe ver el aviso', () => {
        expect(shouldShowPendingNotice('companyadmin', 'PENDING')).toBe(true);
    });

    it('mientras la empresa carga (status null) no debe ver el aviso', () => {
        expect(shouldShowPendingNotice('companyadmin', null)).toBe(false);
    });

    it('el superadmin no ve el aviso aunque la empresa esté PENDING', () => {
        expect(shouldShowPendingNotice('superadmin', 'PENDING')).toBe(false);
    });
});

describe('PendingApprovalNotice', () => {
    it('cuando visible=true, muestra el título y advierte que no recibirá pedidos ni generará ideas con IA', () => {
        const html = renderToStaticMarkup(<PendingApprovalNotice visible={true} />);

        expect(html).toContain('role="status"');
        expect(html).toContain('Tu tienda está en revisión');
        expect(html).toContain('no recibirá pedidos');
        expect(html).toContain('ideas con IA');
    });

    it('cuando visible=false, no renderiza nada', () => {
        const html = renderToStaticMarkup(<PendingApprovalNotice visible={false} />);

        expect(html).toBe('');
    });
});

describe('loadSetupData y el progreso tras volver al panel', () => {
    it('al cambiar de pantalla (por ejemplo tras crear una categoría con imagen propia), se vuelve a llamar a los servicios y el progreso se actualiza', async () => {
        const noProducts: Product[] = [];
        const noShipping: ShippingMethod[] = [];

        const getCategories = vi
            .fn<SetupServices['getCategories']>()
            .mockResolvedValueOnce([
                { id: 'cat1', name: 'General', icon: 'icon', companyId: 'c1', image: defaultHeroImages[0] },
            ] as Category[])
            .mockResolvedValueOnce([
                { id: 'cat1', name: 'Tazas', icon: 'icon', companyId: 'c1', image: 'https://cdn.example.com/tazas.jpg' },
            ] as Category[]);

        const services: SetupServices = {
            getCompany: vi.fn().mockResolvedValue(baseCompany),
            getCategories,
            getProducts: vi.fn().mockResolvedValue(noProducts),
            getShippingMethods: vi.fn().mockResolvedValue(noShipping),
        };

        const firstData = await loadSetupData('c1', services);
        const firstProgress = computeSetupProgress(firstData);
        expect(firstProgress.completed).toBe(0);

        // Simula la navegación de vuelta al panel (cambio de pathname) tras crear la categoría.
        const secondData = await loadSetupData('c1', services);
        const secondProgress = computeSetupProgress(secondData);

        expect(getCategories).toHaveBeenCalledTimes(2);
        expect(secondProgress.completed).toBe(1);
        expect(secondProgress.steps).toEqual([
            { key: 'store', done: false },
            { key: 'categories', done: true },
            { key: 'products', done: false },
            { key: 'shipping', done: false },
        ]);
    });
});

describe('shouldLoadSetupData', () => {
    it('companyadmin con companyId y progreso no completo -> true', () => {
        expect(shouldLoadSetupData('companyadmin', 'c1', false)).toBe(true);
    });

    it('companyadmin con progreso ya completo -> false (no vuelve a pedir datos)', () => {
        expect(shouldLoadSetupData('companyadmin', 'c1', true)).toBe(false);
    });

    it('superadmin -> false, no se piden esos datos', () => {
        expect(shouldLoadSetupData('superadmin', 'c1', false)).toBe(false);
    });

    it('sin companyId -> false', () => {
        expect(shouldLoadSetupData('companyadmin', undefined, false)).toBe(false);
        expect(shouldLoadSetupData('companyadmin', null, false)).toBe(false);
        expect(shouldLoadSetupData('companyadmin', '', false)).toBe(false);
    });
});

describe('shouldShowSetupGuide', () => {
    it('companyadmin con progreso incompleto -> true', () => {
        const progress = computeSetupProgress({ company: null, categories: [], products: [], shippingMethods: [] });
        expect(shouldShowSetupGuide('companyadmin', 'c1', progress)).toBe(true);
    });

    it('companyadmin con progreso completo (4 de 4) -> false', () => {
        const fullCompany: Company = { ...baseCompany, logo: 'logo.png', phone: '555' };
        const categories: Category[] = [
            { id: 'cat1', name: 'Tazas', icon: 'icon', companyId: 'c1', image: 'https://cdn.example.com/tazas.jpg' },
        ];
        const products: Product[] = [
            {
                id: 'p1',
                name: 'Taza propia',
                description: 'desc',
                price: 10,
                category: 'Tazas',
                images: ['https://cdn.example.com/taza-propia.jpg'],
                companyId: 'c1',
            },
        ];
        const shippingMethods: ShippingMethod[] = [{ id: 's1', name: 'Local', price: 1, companyId: 'c1' }];
        const progress = computeSetupProgress({ company: fullCompany, categories, products, shippingMethods });

        expect(shouldShowSetupGuide('companyadmin', 'c1', progress)).toBe(false);
    });

    it('superadmin no ve la checklist aunque el progreso esté incompleto', () => {
        const progress = computeSetupProgress({ company: null, categories: [], products: [], shippingMethods: [] });
        expect(shouldShowSetupGuide('superadmin', 'c1', progress)).toBe(false);
    });

    it('sin progreso calculado todavía -> false', () => {
        expect(shouldShowSetupGuide('companyadmin', 'c1', null)).toBe(false);
    });
});
