import { CartItem } from '../types';
import { Coupon } from '../types/coupon';

export interface CartTotal {
  subtotal: number;
  discount: number;
  total: number;
}

/**
 * Calcula el subtotal, descuento y total de un carrito, aplicando (si corresponde)
 * un cupón vigente. Lógica extraída de CartContext.getCartTotal (ticket #2).
 */
export function calculateCartTotal(
  items: CartItem[],
  appliedCoupon: Coupon | null | undefined
): CartTotal {
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  let discount = 0;

  if (appliedCoupon) {
    if (appliedCoupon.minPurchase && subtotal < appliedCoupon.minPurchase) {
      // Coupon is not valid if min purchase is not met, but we don't remove it yet
    } else {
      if (appliedCoupon.discountType === 'percentage') {
        discount = subtotal * (appliedCoupon.discountValue / 100);
      } else {
        discount = appliedCoupon.discountValue;
      }
    }
  }

  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}
