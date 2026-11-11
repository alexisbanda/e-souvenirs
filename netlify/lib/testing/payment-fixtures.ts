/** Datos y dependencias de prueba de las funciones de pago. No es un test. */
import { vi } from 'vitest';
import Stripe from 'stripe';
import type { Handler } from '@netlify/functions';
import { createFakeFirestore } from './fake-firestore';
import { defaultDeps, type PaymentDeps } from '../payments/deps';

export const PAYPHONE_TOKEN = 'SECRET-TOKEN-XYZ';
export const WEBHOOK_SECRET = 'whsec_test_secret';

export const validCustomer = { name: 'Ada Lovelace', email: 'ada@example.com', address: 'Calle 1', city: 'Quito', postalCode: '170150', phone: '0991234567' };

/** Ejemplo canónico: 2 tazas de $10, cupón del 10 % y envío de $5 = 2300 centavos. */
export const validBody = {
  companyId: 'c1',
  items: [{ productId: 'taza', quantity: 2, customization: { text: 'Ana' } }],
  couponCode: 'promo',
  shippingMethodId: 'envio',
  customer: validCustomer,
};

export const expectedItems = [{ productId: 'taza', productName: 'Taza', quantity: 2, price: 10, customization: { text: 'Ana' } }];

export const createPaymentTestEnv = () => {
  const fake = createFakeFirestore();
  const verifyIdToken = vi.fn(async (token: string) => {
    if (token === 'good-token') return { uid: 'u1' };
    if (token === 'other-token') return { uid: 'u2' };
    throw Object.assign(new Error('Decoding Firebase ID token failed.'), { code: 'auth/argument-error' });
  });
  const fetch = vi.fn();
  const realStripe = new Stripe('sk_test_dummy');
  const stripe = {
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
    webhooks: realStripe.webhooks,
  };
  const env: Record<string, string | undefined> = { URL: 'https://tienda.example', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET };
  const deps: PaymentDeps = {
    getFirebase: () => ({ db: fake.db, auth: { verifyIdToken }, serverTimestamp: () => 'server-timestamp' }),
    getStripe: () => stripe as unknown as Stripe,
    fetch,
    randomId: defaultDeps().randomId,
    env,
  };

  const seed = () => {
    fake.docs.set('companies/c1', { status: 'ACTIVE', name: 'Tazas Ana', slug: 'tazas-ana' });
    fake.docs.set('companies/c2', { status: 'ACTIVE', name: 'Otra', slug: 'otra' });
    fake.docs.set('products/taza', { name: 'Taza', price: 10, companyId: 'c1' });
    fake.docs.set('shippingMethods/envio', { name: 'Courier', price: 5, companyId: 'c1' });
    fake.docs.set('coupons/promo', { code: 'PROMO', companyId: 'c1', discountType: 'percentage', discountValue: 10, isActive: true });
  };

  const usePayphone = (extra: object = {}) =>
    fake.docs.set('paymentCredentials/c1', { provider: 'payphone', payphone: { token: PAYPHONE_TOKEN, storeId: 'store-1', ...extra } });
  const useStripe = () => fake.docs.set('paymentCredentials/c1', { provider: 'stripe' });

  /** Intento pendiente del ejemplo canónico, como lo guarda create-card-payment. */
  const seedAttempt = (id: string, overrides: object = {}) =>
    fake.docs.set(`cardPayments/${id}`, {
      companyId: 'c1',
      userId: 'u1',
      provider: 'payphone',
      amountCents: 2300,
      customer: validCustomer,
      items: expectedItems,
      total: 23,
      shippingMethod: 'Courier',
      shippingCost: 5,
      couponCode: 'PROMO',
      discount: 2,
      status: 'pending',
      createdAt: 'server-timestamp',
      ...overrides,
    });

  return { fake, deps, env, fetch, stripe, verifyIdToken, seed, usePayphone, useStripe, seedAttempt };
};

export type Response = { statusCode: number; body: string };

export const invoke = async (
  handler: Handler,
  { method = 'POST', token = 'good-token' as string | null, body = undefined as unknown, rawBody = undefined as string | undefined, headers = {} as Record<string, string>, isBase64Encoded = false } = {},
) =>
  (await handler(
    {
      httpMethod: method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: rawBody ?? JSON.stringify(body ?? {}),
      isBase64Encoded,
    } as never,
    {} as never,
  )) as Response;

export const parsed = (response: Response) => JSON.parse(response.body);

/** Respuesta de fetch como la que devuelve Payphone. */
export const jsonReply = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

/** Todo lo que se escribió en la consola, para buscar secretos o datos personales. */
export const consoleOutput = () =>
  JSON.stringify((['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => vi.mocked(console[level]).mock.calls));

export const silenceConsole = () => {
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation(() => {});
};
