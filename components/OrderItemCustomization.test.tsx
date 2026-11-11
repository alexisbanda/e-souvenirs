import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import OrderItemCustomization, { customizationLines } from './OrderItemCustomization';

describe('OrderItemCustomization', () => {
    it('muestra cada campo en su propia línea con la etiqueta guardada', () => {
        const html = renderToStaticMarkup(
            <OrderItemCustomization
                item={{
                    customization: { text: 'Sofía', color: 'Rojo' },
                    customizationLabels: { text: 'Nombre a grabar', color: 'Color del lazo' },
                }}
            />,
        );

        expect(html).toContain('<li>Nombre a grabar: Sofía</li><li>Color del lazo: Rojo</li>');
        expect(html).not.toContain('Personalización:');
        expect(html).not.toContain('text:');
    });

    it('un pedido antiguo sin etiquetas usa la clave', () => {
        const html = renderToStaticMarkup(<OrderItemCustomization item={{ customization: { text: 'Sofía' } }} />);

        expect(html).toContain('<li>text: Sofía</li>');
    });

    it('si falta la etiqueta de un campo usa su clave y no muestra valores vacíos', () => {
        expect(
            customizationLines({
                customization: { text: 'Sofía', color: 'Rojo', date: '' },
                customizationLabels: { text: 'Nombre a grabar' },
            }),
        ).toEqual(['Nombre a grabar: Sofía', 'color: Rojo']);
        expect(customizationLines({ customization: { text: '   ', date: '' } })).toEqual([]);
    });

    it('una clave que coincide con un método de Object usa la clave, no el método', () => {
        const customization = { toString: 'Sofía', constructor: 'Rojo' } as unknown as Record<string, string>;

        expect(customizationLines({ customization, customizationLabels: {} })).toEqual(['toString: Sofía', 'constructor: Rojo']);
    });

    it('sin personalización no muestra nada', () => {
        expect(renderToStaticMarkup(<OrderItemCustomization item={{ customization: {} }} />)).toBe('');
    });
});
