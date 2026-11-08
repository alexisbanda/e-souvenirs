/**
 * Métodos de pago activos de una tienda. Funciones puras, sin Firebase:
 * las usan el checkout, la ficha de empresa y las funciones de Netlify.
 */

export type ManualPaymentMethod = 'transfer' | 'cash';
export type CheckoutPaymentMethod = ManualPaymentMethod | 'card';

export interface PaymentMethodsSetting {
  transfer: boolean;
  cash: boolean;
}

/**
 * Lee `company.paymentMethods` tal como venga de Firestore. Si falta el campo
 * o una clave, ese método está activo: solo un `false` explícito lo desactiva.
 */
export const resolvePaymentMethods = (value: unknown): PaymentMethodsSetting => {
  const stored = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  return { transfer: stored.transfer !== false, cash: stored.cash !== false };
};

/** Métodos que el checkout muestra, en orden; el primero es el marcado por defecto. */
export const checkoutPaymentOptions = (
  company: { paymentMethods?: unknown; cardProvider?: unknown } | null | undefined,
): CheckoutPaymentMethod[] => {
  const { transfer, cash } = resolvePaymentMethods(company?.paymentMethods);
  const options: CheckoutPaymentMethod[] = [];
  if (transfer) options.push('transfer');
  if (cash) options.push('cash');
  if (company?.cardProvider) options.push('card');
  return options;
};

/** Una tienda debe tener al menos un método de pago activo. */
export const hasAnyPaymentMethod = ({ transfer, cash, card }: { transfer: boolean; cash: boolean; card: boolean }) =>
  transfer || cash || card;

/**
 * Lo que la ficha de empresa envía a Firestore. Nunca incluye `cardProvider`: solo lo
 * escribe la función manage-card-provider, junto con las credenciales; reenviarlo desde
 * un estado local desfasado activaría la tarjeta sin credenciales. Quitar la clave no
 * borra el campo, porque updateDoc solo toca las claves que recibe.
 * Solo el superadmin escribe `paymentMethods`: un companyadmin envía el valor tal como
 * lo leyó, o firestore.rules rechazaría el update.
 */
export const companyFormPayload = <T extends { cardProvider?: unknown; paymentMethods?: unknown }>(
  company: T,
  isSuperadmin: boolean,
): Omit<T, 'cardProvider'> => {
  const payload: T = { ...company };
  delete payload.cardProvider;
  return isSuperadmin ? { ...payload, paymentMethods: resolvePaymentMethods(company.paymentMethods) } : payload;
};
