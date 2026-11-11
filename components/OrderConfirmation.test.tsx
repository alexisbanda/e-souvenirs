import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
    }),
}));

import OrderConfirmation from './OrderConfirmation';

const render = (props: Partial<React.ComponentProps<typeof OrderConfirmation>> = {}) =>
    renderToStaticMarkup(
        <MemoryRouter>
            <OrderConfirmation
                orderNumber="7F3K2A9Q"
                total={45}
                method="transfer"
                slug="gisam"
                onBackHome={() => {}}
                {...props}
            />
        </MemoryRouter>,
    );

describe('OrderConfirmation', () => {
    it('muestra el número de pedido y el total', () => {
        const html = render();
        expect(html).toContain('7F3K2A9Q');
        expect(html).toContain('45.00');
    });

    it('transferencia: muestra el título, el transferText de la tienda y la indicación del comprobante', () => {
        const html = render({ method: 'transfer', transferText: 'Banco Pichincha 123' });
        expect(html).toContain('checkout.transfer_title');
        expect(html).toContain('Banco Pichincha 123');
        expect(html).toContain('checkout.send_receipt_hint');
        expect(html).toContain('7F3K2A9Q');
    });

    it('transferencia: usa el texto por defecto cuando la tienda no escribió transferText', () => {
        const html = render({ method: 'transfer', transferText: '' });
        expect(html).toContain('checkout.transfer_default_text');
    });

    it('efectivo: muestra el título y el cashText de la tienda', () => {
        const html = render({ method: 'cash', cashText: 'Paga en el local' });
        expect(html).toContain('checkout.cash_title');
        expect(html).toContain('Paga en el local');
    });

    it('efectivo: usa el texto por defecto cuando la tienda no escribió cashText', () => {
        const html = render({ method: 'cash', cashText: '' });
        expect(html).toContain('checkout.cash_default_text');
    });

    it('tarjeta: muestra que el pago fue aprobado', () => {
        const html = render({ method: 'card' });
        expect(html).toContain('checkout.card_approved');
    });

    it('enlace "Ver mis pedidos" apunta a /<slug>/perfil', () => {
        const html = render({ slug: 'gisam' });
        expect(html).toContain('href="/gisam/perfil"');
        expect(html).toContain('checkout.view_my_orders_link');
    });
});

describe('traducciones nuevas del checkout en es.json y en.json', () => {
    const readLocale = (file: string) =>
        JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'public', 'locales', file), 'utf-8'));

    it.each(['es.json', 'en.json'])('%s tiene las claves nuevas de la pantalla final, no vacías', (file) => {
        const { checkout } = readLocale(file);
        for (const key of ['order_number_label', 'send_receipt_hint', 'card_approved', 'view_my_orders_link']) {
            expect(checkout[key], `checkout.${key}`).toEqual(expect.any(String));
            expect(checkout[key].trim()).not.toBe('');
        }
    });
});
