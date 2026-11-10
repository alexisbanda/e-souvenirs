import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
    StoreSetupGuide,
    dismissSetupGuide,
    isSetupGuideDismissed,
    shouldShowSetupGuide,
} from './StoreSetupGuide';

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

describe('shouldShowSetupGuide', () => {
    it('companyadmin con companyId y sin dismiss -> true', () => {
        expect(shouldShowSetupGuide('companyadmin', 'abc', false)).toBe(true);
    });

    it('superadmin -> false', () => {
        expect(shouldShowSetupGuide('superadmin', 'abc', false)).toBe(false);
    });

    it('client -> false', () => {
        expect(shouldShowSetupGuide('client', 'abc', false)).toBe(false);
    });

    it('sin companyId -> false', () => {
        expect(shouldShowSetupGuide('companyadmin', '', false)).toBe(false);
        expect(shouldShowSetupGuide('companyadmin', undefined, false)).toBe(false);
        expect(shouldShowSetupGuide('companyadmin', null, false)).toBe(false);
    });

    it('dismissed -> false', () => {
        expect(shouldShowSetupGuide('companyadmin', 'abc', true)).toBe(false);
    });
});

describe('StoreSetupGuide render', () => {
    it('muestra los 4 pasos en orden con sus hrefs y el texto Entendido', () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <StoreSetupGuide companyId="abc" onDismiss={() => {}} />
            </MemoryRouter>,
        );

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

        expect(html).toContain('Entendido');
        expect(html).toContain('role="region"');
    });
});

describe('persistencia del dismiss en localStorage (por tienda)', () => {
    it('al llamar dismissSetupGuide, isSetupGuideDismissed es true para esa tienda y false para otra', () => {
        const storage = createMemoryStorage();

        expect(isSetupGuideDismissed(storage, 'abc')).toBe(false);

        dismissSetupGuide(storage, 'abc');

        expect(isSetupGuideDismissed(storage, 'abc')).toBe(true);
        expect(isSetupGuideDismissed(storage, 'xyz')).toBe(false);
    });

    it('un storage que lanza no rompe nada: isSetupGuideDismissed es false y la guía sigue visible', () => {
        const storage = createThrowingStorage();

        expect(() => dismissSetupGuide(storage, 'abc')).not.toThrow();
        expect(() => isSetupGuideDismissed(storage, 'abc')).not.toThrow();
        expect(isSetupGuideDismissed(storage, 'abc')).toBe(false);
        expect(shouldShowSetupGuide('companyadmin', 'abc', isSetupGuideDismissed(storage, 'abc'))).toBe(true);
    });

    it('storage null o undefined no lanza y se considera no-dismissed', () => {
        expect(isSetupGuideDismissed(null, 'abc')).toBe(false);
        expect(isSetupGuideDismissed(undefined, 'abc')).toBe(false);
        expect(() => dismissSetupGuide(null, 'abc')).not.toThrow();
        expect(() => dismissSetupGuide(undefined, 'abc')).not.toThrow();
    });
});
