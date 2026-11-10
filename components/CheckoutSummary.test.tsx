import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import CheckoutSummary from './CheckoutSummary';

describe('CheckoutSummary', () => {
    it('muestra la línea del cupón con código e importe negativo cuando hay descuento', () => {
        const html = renderToStaticMarkup(
            <CheckoutSummary subtotal={38} discount={1.9} couponCode="PRUEBA53" shipping={3.62} total={39.72} />,
        );

        expect(html).toContain('cart.discount');
        expect(html).toContain('PRUEBA53');
        expect(html).toContain('-$1.90');
    });

    it('no muestra la línea del cupón cuando el descuento es 0, con o sin código', () => {
        const sinCodigo = renderToStaticMarkup(
            <CheckoutSummary subtotal={38} discount={0} shipping={3.62} total={41.62} />,
        );
        const conCodigo = renderToStaticMarkup(
            <CheckoutSummary subtotal={38} discount={0} couponCode="PRUEBA53" shipping={3.62} total={41.62} />,
        );

        expect(sinCodigo).not.toContain('cart.discount');
        expect(conCodigo).not.toContain('cart.discount');
    });

    it('cuadra las cifras del resumen', () => {
        const html = renderToStaticMarkup(
            <CheckoutSummary subtotal={38} discount={1.9} couponCode="PRUEBA53" shipping={3.62} total={39.72} />,
        );

        expect(html).toContain('$38.00');
        expect(html).toContain('-$1.90');
        expect(html).toContain('$3.62');
        expect(html).toContain('$39.72');
    });
});
