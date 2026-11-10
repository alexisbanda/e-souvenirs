import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import StoreRequirementsList, { STORE_REQUIREMENT_KEYS } from './StoreRequirementsList';

describe('StoreRequirementsList', () => {
    it('renderiza el título y las 7 claves de los elementos requeridos', () => {
        const html = renderToStaticMarkup(<StoreRequirementsList />);

        expect(html).toContain('company_registration.requirements_title');
        expect(STORE_REQUIREMENT_KEYS).toHaveLength(7);
        STORE_REQUIREMENT_KEYS.forEach((key) => {
            expect(html).toContain(`company_registration.requirements_items.${key}`);
        });
    });
});

describe('traducciones de requirements en es.json y en.json', () => {
    const readLocale = (file: string) =>
        JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'public', 'locales', file), 'utf-8'));

    it.each(['es.json', 'en.json'])('%s tiene el título y las 7 claves de items, no vacías', (file) => {
        const locale = readLocale(file);
        const requirements = locale.company_registration;

        expect(typeof requirements.requirements_title).toBe('string');
        expect(requirements.requirements_title.length).toBeGreaterThan(0);

        STORE_REQUIREMENT_KEYS.forEach((key) => {
            const value = requirements.requirements_items[key];
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
        });
    });

    it('la descripción de categorías menciona que la imagen es opcional (es/en)', () => {
        const es = readLocale('es.json');
        const en = readLocale('en.json');

        expect(es.company_registration.requirements_items.categories.toLowerCase()).toContain('opcional');
        expect(en.company_registration.requirements_items.categories.toLowerCase()).toContain('optional');
    });
});

describe('uso de StoreRequirementsList en el registro de empresa', () => {
    it('CompanyRegistrationPage importa y usa StoreRequirementsList en el paso 1', () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '..', 'pages', 'CompanyRegistrationPage.tsx'),
            'utf-8',
        );

        expect(source).toContain("import StoreRequirementsList from '../components/StoreRequirementsList'");
        expect(source).toContain('<StoreRequirementsList');
    });
});
