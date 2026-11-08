import { describe, expect, it } from 'vitest';
import { checkoutPaymentOptions, companyFormPayload, hasAnyPaymentMethod, resolvePaymentMethods } from './paymentMethods';

describe('resolvePaymentMethods', () => {
  it.each([[undefined], [null], ['transfer'], [42], [[]], [{}]])('con %j deja todo activo', (value) => {
    expect(resolvePaymentMethods(value)).toEqual({ transfer: true, cash: true });
  });

  it('solo un false explícito desactiva', () => {
    expect(resolvePaymentMethods({ transfer: false, cash: true })).toEqual({ transfer: false, cash: true });
    expect(resolvePaymentMethods({ cash: false })).toEqual({ transfer: true, cash: false });
    expect(resolvePaymentMethods({ transfer: 'false', cash: 0 })).toEqual({ transfer: true, cash: true });
    expect(resolvePaymentMethods({ transfer: null, cash: undefined })).toEqual({ transfer: true, cash: true });
  });
});

describe('checkoutPaymentOptions', () => {
  it('sin el campo y sin tarjeta muestra transferencia y efectivo', () => {
    expect(checkoutPaymentOptions({})).toEqual(['transfer', 'cash']);
    expect(checkoutPaymentOptions(null)).toEqual(['transfer', 'cash']);
  });

  it('con todo activo y tarjeta muestra los tres en orden', () => {
    expect(checkoutPaymentOptions({ paymentMethods: { transfer: true, cash: true }, cardProvider: 'stripe' }))
      .toEqual(['transfer', 'cash', 'card']);
  });

  it('solo transferencia', () => {
    expect(checkoutPaymentOptions({ paymentMethods: { transfer: true, cash: false } })).toEqual(['transfer']);
  });

  it('solo efectivo', () => {
    expect(checkoutPaymentOptions({ paymentMethods: { transfer: false, cash: true } })).toEqual(['cash']);
  });

  it('solo tarjeta', () => {
    expect(checkoutPaymentOptions({ paymentMethods: { transfer: false, cash: false }, cardProvider: 'payphone' })).toEqual(['card']);
  });

  it('sin nada activo devuelve una lista vacía', () => {
    expect(checkoutPaymentOptions({ paymentMethods: { transfer: false, cash: false } })).toEqual([]);
  });
});

describe('hasAnyPaymentMethod', () => {
  it('es false con los tres desactivados', () => {
    expect(hasAnyPaymentMethod({ transfer: false, cash: false, card: false })).toBe(false);
  });

  it.each([
    [{ transfer: true, cash: false, card: false }],
    [{ transfer: false, cash: true, card: false }],
    [{ transfer: false, cash: false, card: true }],
    [{ transfer: true, cash: true, card: true }],
  ])('es true con %j', (methods) => {
    expect(hasAnyPaymentMethod(methods)).toBe(true);
  });
});

describe('companyFormPayload', () => {
  const company = { name: 'Tienda', cardProvider: 'payphone' as const, paymentMethods: { transfer: false, cash: true } };

  it.each([[true], [false]])('nunca envía cardProvider (superadmin: %s)', (isSuperadmin) => {
    const payload = companyFormPayload(company, isSuperadmin);
    expect(payload).not.toHaveProperty('cardProvider');
    expect(company.cardProvider).toBe('payphone');
  });

  it('el superadmin envía paymentMethods resuelto', () => {
    expect(companyFormPayload({ name: 'Tienda', cardProvider: 'stripe' as const }, true)).toEqual({
      name: 'Tienda',
      paymentMethods: { transfer: true, cash: true },
    });
    expect(companyFormPayload(company, true)).toEqual({ name: 'Tienda', paymentMethods: { transfer: false, cash: true } });
  });

  it('el companyadmin no añade paymentMethods y no cambia el que leyó', () => {
    expect(companyFormPayload({ name: 'Tienda', cardProvider: 'stripe' as const }, false)).toEqual({ name: 'Tienda' });
    expect(companyFormPayload(company, false)).toEqual({ name: 'Tienda', paymentMethods: { transfer: false, cash: true } });
  });
});
