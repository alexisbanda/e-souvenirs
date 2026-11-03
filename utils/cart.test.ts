import { describe, expect, it } from 'vitest';
import { calculateCartTotal, calculateOrderTotalCents } from './cart';
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

    expect(result).toEqual({ subtotal: 10, discount: 10, total: 0 });
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

describe('calculateOrderTotalCents', () => {
  const percent = (discountValue: number, minPurchase?: number) => ({ discountType: 'percentage' as const, discountValue, minPurchase });
  const fixed = (discountValue: number, minPurchase?: number) => ({ discountType: 'fixed' as const, discountValue, minPurchase });

  it('da 2300 centavos con 2 × $10, cupón del 10 % y envío de $5', () => {
    const result = calculateOrderTotalCents({ lines: [{ price: 10, quantity: 2 }], coupon: percent(10), shippingCost: 5 });

    expect(result).toEqual({ subtotal: 2000, discount: 200, shipping: 500, total: 2300, minPurchaseMet: true });
  });

  it('no arrastra errores de coma flotante: 3 × $19.99 con 15 %', () => {
    const result = calculateOrderTotalCents({ lines: [{ price: 19.99, quantity: 3 }], coupon: percent(15), shippingCost: 4.1 });

    // 5997 × 15 % = 899.55, que se redondea a 900.
    expect(result).toEqual({ subtotal: 5997, discount: 900, shipping: 410, total: 5507, minPurchaseMet: true });
  });

  it.each([
    [0.1, 3, 30],
    [1.15, 1, 115],
    [4.35, 100, 43500],
    [19.99, 1000, 1999000],
  ])('convierte %d × %d a %d centavos exactos', (price, quantity, subtotal) => {
    expect(calculateOrderTotalCents({ lines: [{ price, quantity }] }).subtotal).toBe(subtotal);
  });

  it('suma varias líneas', () => {
    const result = calculateOrderTotalCents({ lines: [{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }] });

    expect(result.total).toBe(30);
  });

  it('aplica un cupón fijo y suma el envío', () => {
    const result = calculateOrderTotalCents({ lines: [{ price: 10, quantity: 2 }], coupon: fixed(5.5), shippingCost: 5 });

    expect(result).toMatchObject({ discount: 550, total: 1950 });
  });

  it('el cupón fijo mayor que el subtotal se limita al subtotal, y el envío se sigue cobrando', () => {
    const result = calculateOrderTotalCents({ lines: [{ price: 10, quantity: 1 }], coupon: fixed(50), shippingCost: 5 });

    expect(result).toMatchObject({ subtotal: 1000, discount: 1000, shipping: 500, total: 500 });
  });

  it('un porcentaje mayor que 100 tampoco supera el subtotal', () => {
    expect(calculateOrderTotalCents({ lines: [{ price: 10, quantity: 1 }], coupon: percent(150) }).discount).toBe(1000);
  });

  it('por debajo de la compra mínima no descuenta e informa de ello', () => {
    const result = calculateOrderTotalCents({ lines: [{ price: 10, quantity: 1 }], coupon: percent(10, 20), shippingCost: 5 });

    expect(result).toMatchObject({ discount: 0, total: 1500, minPurchaseMet: false });
  });

  it('justo en la compra mínima descuenta, también con importes que fallan en coma flotante', () => {
    const result = calculateOrderTotalCents({ lines: [{ price: 19.99, quantity: 3 }], coupon: fixed(1, 59.97) });

    expect(result).toMatchObject({ discount: 100, minPurchaseMet: true });
  });

  it('sin cupón ni envío, el total es el subtotal', () => {
    expect(calculateOrderTotalCents({ lines: [{ price: 10, quantity: 2 }] })).toEqual({
      subtotal: 2000,
      discount: 0,
      shipping: 0,
      total: 2000,
      minPurchaseMet: true,
    });
  });

  it('un descuento negativo o no numérico no sube el total', () => {
    const lines = [{ price: 10, quantity: 1 }];

    expect(calculateOrderTotalCents({ lines, coupon: fixed(-5) }).total).toBe(1000);
    expect(calculateOrderTotalCents({ lines, coupon: fixed(Number.NaN) }).total).toBe(1000);
  });

  it('calculateCartTotal devuelve en dólares el mismo cálculo, sin envío', () => {
    const items = [makeCartItem({ quantity: 3, product: makeProduct({ price: 19.99 }) })];

    expect(calculateCartTotal(items, makeCoupon({ discountValue: 15 }))).toEqual({ subtotal: 59.97, discount: 9, total: 50.97 });
  });
});
