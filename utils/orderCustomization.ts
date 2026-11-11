import type { Order } from '../types';

export type CustomizationItem = Pick<Order['items'][number], 'customization' | 'customizationLabels'>;

/**
 * Líneas 'Etiqueta: valor' de la personalización de un artículo, solo de los campos con valor.
 * Usa la etiqueta guardada con el pedido y, si no existe (pedidos antiguos), la clave.
 * Sin React: la usan el panel (OrderItemCustomization) y el correo de aviso de venta del servidor.
 */
export const customizationLines = ({ customization, customizationLabels }: CustomizationItem): string[] =>
    Object.entries(customization ?? {})
        .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value] as const)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => {
            // Object.hasOwn: una clave como 'toString' no debe tomar el método del prototipo como etiqueta.
            const label = customizationLabels && Object.hasOwn(customizationLabels, key) ? customizationLabels[key] : undefined;
            return `${label || key}: ${value}`;
        });
