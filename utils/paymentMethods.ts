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
