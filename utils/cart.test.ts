import { describe, expect, it } from 'vitest';
import { calculateCartTotal } from './cart';
import { CartItem, Product } from '../types';
import { Coupon } from '../types/coupon';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Souvenir',
    description: 'Un souvenir artesanal',
    price: 10,
    category: 'general',
    images: [],
    companyId: 'company-1',
    ...overrides,
  };
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'cart-item-1',
    product: makeProduct(),
    quantity: 1,
    customization: {},
    ...overrides,
  };
}

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon-1',
    code: 'DESCUENTO',
    discountType: 'percentage',
    discountValue: 10,
    companyId: 'company-1',
    isActive: true,
    ...overrides,
  };
}

describe('calculateCartTotal', () => {
  it('returns subtotal and total without discount when there is no coupon', () => {
    const items: CartItem[] = [makeCartItem({ quantity: 2, product: makeProduct({ price: 10 }) })];

    const result = calculateCartTotal(items, null);

    expect(result).toEqual({ subtotal: 20, discount: 0, total: 20 });
  });

  it('applies a percentage coupon over the subtotal', () => {
    const items: CartItem[] = [makeCartItem({ quantity: 2, product: makeProduct({ price: 10 }) })];
    const coupon = makeCoupon({ discountType: 'percentage', discountValue: 10 });

    const result = calculateCartTotal(items, coupon);

    expect(result).toEqual({ subtotal: 20, discount: 2, total: 18 });
  });

  it('applies a fixed coupon as an absolute discount', () => {
    const items: CartItem[] = [makeCartItem({ quantity: 2, product: makeProduct({ price: 10 }) })];
    const coupon = makeCoupon({ discountType: 'fixed', discountValue: 5 });

    const result = calculateCartTotal(items, coupon);

    expect(result).toEqual({ subtotal: 20, discount: 5, total: 15 });
  });

  it('never returns a negative total when a fixed coupon is larger than the subtotal', () => {
    const items: CartItem[] = [makeCartItem({ quantity: 1, product: makeProduct({ price: 10 }) })];
    const coupon = makeCoupon({ discountType: 'fixed', discountValue: 50 });

    const result = calculateCartTotal(items, coupon);

    expect(result).toEqual({ subtotal: 10, discount: 50, total: 0 });
  });

  it('returns zero totals for an empty cart', () => {
    const result = calculateCartTotal([], null);

    expect(result).toEqual({ subtotal: 0, discount: 0, total: 0 });
  });

  it('treats an undefined coupon the same as no coupon', () => {
    const items: CartItem[] = [makeCartItem({ quantity: 1, product: makeProduct({ price: 15 }) })];

    const result = calculateCartTotal(items, undefined);

    expect(result).toEqual({ subtotal: 15, discount: 0, total: 15 });
  });
});
