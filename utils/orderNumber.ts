/**
 * Número de pedido visible: los 8 primeros caracteres del id de Firestore en mayúsculas.
 * Lo usan la pantalla final del checkout y la lista/detalle del panel, para que
 * comprador y vendedor vean el mismo número.
 */
export const formatOrderNumber = (id: string): string => id.slice(0, 8).toUpperCase();

interface OrderSearchFields {
    id: string;
    customer: { name: string; email: string };
}

/**
 * Busca un pedido por nombre, email, id o número visible (sin distinguir mayúsculas).
 * Escribir el número visible ('7F3K2A9Q' o '7f3k2a9q') encuentra el pedido cuyo id
 * empieza por esos caracteres.
 */
export const orderMatchesSearch = (order: OrderSearchFields, term: string): boolean => {
    const needle = term.trim().toLowerCase();
    if (!needle) return true;
    return (
        order.customer.name.toLowerCase().includes(needle) ||
        order.customer.email.toLowerCase().includes(needle) ||
        order.id.toLowerCase().includes(needle) ||
        formatOrderNumber(order.id).toLowerCase().includes(needle)
    );
};
