// Solo tipos: una función de Netlify importa este archivo, que no debe arrastrar
// nada del navegador ni de Firebase.
import type { CartItem } from '../types';
import type { Coupon } from '../types/coupon';

export interface CartTotal {
  subtotal: number;
  discount: number;
  total: number;
}

export type OrderCoupon = Pick<Coupon, 'discountType' | 'discountValue' | 'minPurchase'>;

export interface OrderTotalInput {
  /** Precio unitario en dólares. */
  lines: { price: number; quantity: number }[];
  coupon?: OrderCoupon | null;
  /** Costo de envío en dólares. */
  shippingCost?: number;
}

/** Importes en centavos enteros. */
export interface OrderTotalCents {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  /** Falso si el cupón pide una compra mínima que no se alcanza: entonces no descuenta nada. */
  minPurchaseMet: boolean;
}

const toCents = (amount: number | undefined): number =>
  Number.isFinite(amount) ? Math.round((amount as number) * 100) : 0;

/**
 * El único cálculo del total de un pedido, usado por el navegador y por el servidor.
 * Trabaja en centavos enteros para no acumular errores de coma flotante:
 * total = max(0, subtotal - descuento) + envío.
 */
export function calculateOrderTotalCents({ lines, coupon, shippingCost }: OrderTotalInput): OrderTotalCents {
  const subtotal = lines.reduce((sum, line) => sum + toCents(line.price) * line.quantity, 0);
  const shipping = toCents(shippingCost);
  const minPurchaseMet = !coupon?.minPurchase || subtotal >= toCents(coupon.minPurchase);

  let discount = 0;
  if (coupon && minPurchaseMet) {
    const value = Number.isFinite(coupon.discountValue) ? coupon.discountValue : 0;
    const rawDiscount = coupon.discountType === 'percentage' ? Math.round((subtotal * value) / 100) : toCents(value);
    discount = Math.min(subtotal, Math.max(0, rawDiscount));
  }

  return { subtotal, discount, shipping, total: subtotal - discount + shipping, minPurchaseMet };
}

/**
 * Subtotal, descuento y total en dólares de un carrito, sin envío, aplicando
 * (si corresponde) un cupón vigente.
 */
export function calculateCartTotal(
  items: CartItem[],
  appliedCoupon: Coupon | null | undefined
): CartTotal {
  const { subtotal, discount, total } = calculateOrderTotalCents({
    lines: items.map((item) => ({ price: item.product.price, quantity: item.quantity })),
    coupon: appliedCoupon,
  });
  return { subtotal: subtotal / 100, discount: discount / 100, total: total / 100 };
}
