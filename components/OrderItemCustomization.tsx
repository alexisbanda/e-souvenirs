import React from 'react';
import type { Order } from '../types';

type Item = Pick<Order['items'][number], 'customization' | 'customizationLabels'>;

/**
 * Líneas 'Etiqueta: valor' de la personalización de un artículo, solo de los campos con valor.
 * Usa la etiqueta guardada con el pedido y, si no existe (pedidos antiguos), la clave.
 */
export const customizationLines = ({ customization, customizationLabels }: Item): string[] =>
    Object.entries(customization ?? {})
        .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value] as const)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${customizationLabels?.[key] || key}: ${value}`);

/** Personalización de un artículo en el detalle del pedido del panel (español fijo). */
const OrderItemCustomization: React.FC<{ item: Item }> = ({ item }) => {
    const lines = customizationLines(item);
    if (lines.length === 0) return null;
    return (
        <ul className="text-sm text-gray-500">
            {lines.map((line, index) => (
                <li key={index}>{line}</li>
            ))}
        </ul>
    );
};

export default OrderItemCustomization;
