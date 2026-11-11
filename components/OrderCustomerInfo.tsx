import React from 'react';
import type { Order } from '../types';

type Customer = Order['customer'];

/** Une solo las partes no vacías de la dirección (sin comas colgando). */
export const formatCustomerAddress = (customer: Customer): string =>
    [customer.address, customer.city, customer.postalCode]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean)
        .join(', ');

/** Enlace tel: con el número sin espacios. */
export const phoneHref = (phone: string): string => `tel:${phone.replace(/\s+/g, '')}`;

/** Bloque de datos del cliente en el detalle del pedido del panel (español fijo). */
const OrderCustomerInfo: React.FC<{ customer: Customer }> = ({ customer }) => {
    const phone = customer.phone?.trim();
    return (
        <>
            <p><strong>Nombre:</strong> {customer.name}</p>
            <p><strong>Email:</strong> {customer.email}</p>
            {phone && (
                <p><strong>Teléfono:</strong> <a href={phoneHref(phone)} className="text-indigo-600 hover:underline">{phone}</a></p>
            )}
            <p><strong>Dirección:</strong> {formatCustomerAddress(customer)}</p>
        </>
    );
};

export default OrderCustomerInfo;
