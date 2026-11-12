import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
    StoreSetupGuide,
    isSetupGuideCollapsed,
    setSetupGuideCollapsed,
} from './StoreSetupGuide';
import type { SetupProgress } from '../utils/storeSetupProgress';

const createMemoryStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => store.clear(),
        key: () => null,
        length: 0,
    } as unknown as Storage;
};

const createThrowingStorage = (): Storage => ({
    getItem: () => {
        throw new Error('boom');
    },
    setItem: () => {
        throw new Error('boom');
    },
    removeItem: () => {
        throw new Error('boom');
    },
    clear: () => {
        throw new Error('boom');
    },
    key: () => {
        throw new Error('boom');
    },
    length: 0,
} as unknown as Storage);

const progressWith = (completed: number): SetupProgress => {
    const keys: Array<'store' | 'categories' | 'products' | 'shipping'> = [
        'store',
        'categories',
        'products',
        'shipping',
    ];
    return {
        steps: keys.map((key, index) => ({ key, done: index < completed })),
        completed,
        total: 4,
    };
};

describe('StoreSetupGuide render', () => {
    it('con progreso 0 de 4 muestra el contador y los hrefs de los 4 pasos', () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <StoreSetupGuide companyId="abc" progress={progressWith(0)} />
            </MemoryRouter>,
        );

        expect(html).toContain('0 de 4');

        const expectedHrefs = [
            '/admin/companies/edit/abc',
            '/admin/categories',
            '/admin/products',
            '/admin/shipping',
        ];

        const indices = expectedHrefs.map((href) => html.indexOf(`href="${href}"`));
        indices.forEach((index) => expect(index).toBeGreaterThan(-1));
        for (let i = 1; i < indices.length; i += 1) {
            expect(indices[i]).toBeGreaterThan(indices[i - 1]);
        }

        expect(html).not.toContain('Entendido');
        expect(html).toContain('role="region"');
    });

    it('con progreso completo (4 de 4) no renderiza nada', () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <StoreSetupGuide companyId="abc" progress={progressWith(4)} />
            </MemoryRouter>,
        );

        expect(html).toBe('');
    });
});

describe('persistencia de minimizar en localStorage (por tienda)', () => {
    it('al llamar setSetupGuideCollapsed, isSetupGuideCollapsed refleja el estado por tienda', () => {
        const storage = createMemoryStorage();

        expect(isSetupGuideCollapsed(storage, 'abc')).toBe(false);

        setSetupGuideCollapsed(storage, 'abc', true);

        expect(isSetupGuideCollapsed(storage, 'abc')).toBe(true);
        expect(isSetupGuideCollapsed(storage, 'xyz')).toBe(false);
    });

    it('un storage que lanza no rompe nada: isSetupGuideCollapsed es false', () => {
        const storage = createThrowingStorage();

        expect(() => setSetupGuideCollapsed(storage, 'abc', true)).not.toThrow();
        expect(() => isSetupGuideCollapsed(storage, 'abc')).not.toThrow();
        expect(isSetupGuideCollapsed(storage, 'abc')).toBe(false);
    });

    it('storage null o undefined no lanza y se considera no-colapsado', () => {
        expect(isSetupGuideCollapsed(null, 'abc')).toBe(false);
        expect(isSetupGuideCollapsed(undefined, 'abc')).toBe(false);
        expect(() => setSetupGuideCollapsed(null, 'abc', true)).not.toThrow();
        expect(() => setSetupGuideCollapsed(undefined, 'abc', true)).not.toThrow();
    });

    it('renderizada colapsada (localStorage en true) muestra solo la línea con el avance, sin botón Entendido ni de cerrar', () => {
        const storage = createMemoryStorage();
        setSetupGuideCollapsed(storage, 'abc', true);

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <StoreSetupGuide companyId="abc" progress={progressWith(2)} storage={storage} />
            </MemoryRouter>,
        );

        expect(html).toContain('2 de 4');
        expect(html).not.toContain('href="/admin/categories"');
        expect(html).not.toContain('href="/admin/products"');
        expect(html).not.toContain('Entendido');
        expect(html).not.toContain('Minimizar');
    });
});
