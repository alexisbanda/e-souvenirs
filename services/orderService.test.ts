import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({}));
vi.mock('./firebase', () => ({ auth: { currentUser: null }, db: {} }));

import { createCardPayment, createServerOrder, ORDER_ERROR_KEYS } from './orderService';
import { auth } from './firebase';

const fetchMock = vi.fn();
const respond = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValue({ status, json: () => Promise.resolve(body) });

const orderRequest = {
  companyId: 'gisam',
  items: [{ productId: 'p1', quantity: 1 }],
  shippingMethodId: 's1',
  customer: {} as never,
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  (auth as { currentUser: unknown }).currentUser = { getIdToken: () => Promise.resolve('token') };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe('createServerOrder', () => {
  it.each([403, 404])('devuelve store-unavailable cuando el servidor responde %i', async (status) => {
    respond(status);
    await expect(createServerOrder({ ...orderRequest, paymentMethod: 'transfer' })).resolves.toEqual({
      ok: false,
      reason: 'store-unavailable',
    });
  });

  it('sigue devolviendo error ante un 500', async () => {
    respond(500);
    await expect(createServerOrder({ ...orderRequest, paymentMethod: 'transfer' })).resolves.toEqual({ ok: false, reason: 'error' });
  });

  it('sigue devolviendo login ante un 401', async () => {
    respond(401);
    await expect(createServerOrder({ ...orderRequest, paymentMethod: 'cash' })).resolves.toEqual({ ok: false, reason: 'login' });
  });

  it('devuelve el pedido creado ante un 201', async () => {
    respond(201, { orderId: 'o1', total: 10 });
    await expect(createServerOrder({ ...orderRequest, paymentMethod: 'cash' })).resolves.toEqual({ ok: true, orderId: 'o1', total: 10 });
  });
});

describe('createCardPayment', () => {
  it.each([403, 404])('devuelve store-unavailable cuando el servidor responde %i', async (status) => {
    respond(status);
    await expect(createCardPayment(orderRequest)).resolves.toEqual({ ok: false, reason: 'store-unavailable' });
  });

  it('sigue devolviendo error ante un 500', async () => {
    respond(500);
    await expect(createCardPayment(orderRequest)).resolves.toEqual({ ok: false, reason: 'error' });
  });
});

describe('mensaje de tienda que aún no recibe pedidos', () => {
  it('el checkout traduce store-unavailable con checkout.error_store_unavailable', () => {
    expect(ORDER_ERROR_KEYS['store-unavailable']).toBe('checkout.error_store_unavailable');
  });

  it.each(['es', 'en'])('la clave existe en %s y no invita a reintentar', (lang) => {
    const locale = JSON.parse(readFileSync(resolve(__dirname, `../public/locales/${lang}.json`), 'utf8'));
    const text = locale.checkout?.error_store_unavailable;
    expect(typeof text).toBe('string');
    expect(text.trim()).not.toBe('');
    expect(text).not.toMatch(/inténtalo|minutos|try again/i);
  });
});
