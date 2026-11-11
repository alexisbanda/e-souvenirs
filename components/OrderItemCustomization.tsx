import React from 'react';

import { customizationLines, type CustomizationItem as Item } from '../utils/orderCustomization';

export { customizationLines };

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
