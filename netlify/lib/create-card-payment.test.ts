import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardPaymentHandler } from './create-card-payment';
import { splitTax } from './payments/payphone';
import {
  consoleOutput, createPaymentTestEnv, expectedItems, invoke, jsonReply, parsed, PAYPHONE_TOKEN, silenceConsole, validBody, validCustomer,
} from './testing/payment-fixtures';

const PAY_URL = 'https://pay.payphonetodoesposible.com/Anonymous/Index?paymentId=pp-1';

let env: ReturnType<typeof createPaymentTestEnv>;
const start = (body: unknown = validBody, extra: Parameters<typeof invoke>[1] = {}) =>
  invoke(createCardPaymentHandler(env.deps), { body, ...extra });

const prepareCall = (index = 0) => {
  const [url, init] = env.fetch.mock.calls[index];
  return { url, headers: init.headers, body: JSON.parse(init.body) };
};
const attemptKeys = () => env.fake.keys('cardPayments');

describe('create-card-payment', () => {
  beforeEach(() => {
    env = createPaymentTestEnv();
    env.seed();
    env.fetch.mockResolvedValue(jsonReply({ paymentId: 'pp-1', payWithCard: PAY_URL, payWithPayPhone: 'https://x' }));
    env.stripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    silenceConsole();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('petición y sesión', () => {
    it('devuelve 405 si no es POST', async () => {
      expect((await start(validBody, { method: 'GET' })).statusCode).toBe(405);
    });

    it.each([[null], ['bad-token']])('devuelve 401 con el token %s y no guarda nada', async (token) => {
      env.usePayphone();
      expect((await start(validBody, { token })).statusCode).toBe(401);
      expect(env.fake.writes).toEqual([]);
      expect(env.fetch).not.toHaveBeenCalled();
    });

    it('devuelve 400 con un cuerpo que no es JSON', async () => {
      expect((await start(undefined, { rawBody: '{no' })).statusCode).toBe(400);
    });
  });

  describe('Payphone', () => {
    beforeEach(() => env.usePayphone());

    it('prepara 2300 centavos con el token y la tienda de la empresa y devuelve la URL de pago (#1)', async () => {
      const response = await start();

      expect(response.statusCode).toBe(200);
      expect(parsed(response)).toEqual({ url: PAY_URL });
      expect(env.fetch).toHaveBeenCalledTimes(1);
      const [id] = attemptKeys().map((key) => key.split('/')[1]);
      const call = prepareCall();
      expect(call.url).toBe('https://pay.payphonetodoesposible.com/api/button/Prepare');
      expect(call.headers.Authorization).toBe(`Bearer ${PAYPHONE_TOKEN}`);
      expect(call.body).toEqual({
        amount: 2300,
        amountWithoutTax: 2300,
        amountWithTax: 0,
        tax: 0,
        currency: 'USD',
        clientTransactionId: id,
        storeId: 'store-1',
        reference: 'Pedido Tazas Ana',
        responseUrl: 'https://tienda.example/tazas-ana/checkout',
        cancellationUrl: 'https://tienda.example/tazas-ana/checkout?status=cancel',
      });
    });

    it('con taxRate desglosa el IVA incluido y la suma es el total', async () => {
      env.usePayphone({ taxRate: 0.15 });

      await start();

      expect(prepareCall().body).toMatchObject({ amount: 2300, amountWithoutTax: 0, amountWithTax: 2000, tax: 300 });
    });

    it.each([1, 2299, 2300, 5507, 99999])('splitTax(%i, 0.15) suma el total', (cents) => {
      const { amountWithoutTax, amountWithTax, tax } = splitTax(cents, 0.15);
      expect(amountWithoutTax + amountWithTax + tax).toBe(cents);
      expect(tax).toBeGreaterThanOrEqual(0);
    });

    it('usa SITE_URL antes que URL y nunca la cabecera Host', async () => {
      env.env.SITE_URL = 'https://propio.example/';

      await start(validBody, { headers: { host: 'atacante.example', 'x-forwarded-host': 'atacante.example' } });

      expect(prepareCall().body.responseUrl).toBe('https://propio.example/tazas-ana/checkout');
    });

    it('sin URL del sitio responde 500 y no llama al proveedor', async () => {
      delete env.env.URL;

      expect((await start()).statusCode).toBe(500);
      expect(env.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Stripe', () => {
    beforeEach(() => env.useStripe());

    it('crea una Checkout Session de 2300 USD y devuelve su URL (#2)', async () => {
      const response = await start();

      expect(response.statusCode).toBe(200);
      expect(parsed(response)).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
      const [id] = attemptKeys().map((key) => key.split('/')[1]);
      expect(env.stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 2300, product_data: { name: 'Pedido Tazas Ana' } } }],
        client_reference_id: id,
        metadata: { clientTransactionId: id },
        success_url: 'https://tienda.example/tazas-ana/checkout?status=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://tienda.example/tazas-ana/checkout?status=cancel',
      }));
      expect(env.fetch).not.toHaveBeenCalled();
    });
  });

  describe('datos manipulados (#3)', () => {
    beforeEach(() => env.usePayphone());

    it('ignora precios, totales y userId del cuerpo', async () => {
      const response = await start({
        ...validBody,
        total: 1,
        amount: 1,
        discount: 9999,
        userId: 'victima',
        items: [{ ...validBody.items[0], price: 0, total: 0 }],
      });

      expect(response.statusCode).toBe(200);
      expect(prepareCall().body.amount).toBe(2300);
      expect(env.fake.docs.get(attemptKeys()[0])).toMatchObject({ userId: 'u1', amountCents: 2300, total: 23 });
    });

    it.each([
      ['un cupón inexistente', 'invalid', { couponCode: 'NOEXISTE' }, undefined],
      ['un cupón caducado', 'expired', {}, { validUntil: { toDate: () => new Date('2000-01-01') } }],
      ['un cupón inactivo', 'invalid', {}, { isActive: false }],
      ['la compra mínima no cumplida', 'min-purchase', {}, { minPurchase: 100 }],
    ])('con %s responde 422 %s como create-order, sin intento ni proveedor', async (_case, reason, extra, coupon) => {
      if (coupon) env.fake.docs.set('coupons/promo', { ...env.fake.docs.get('coupons/promo'), ...coupon });

      const response = await start({ ...validBody, ...extra });

      expect(response.statusCode).toBe(422);
      expect(parsed(response).reason).toBe(reason);
      expect(attemptKeys()).toEqual([]);
      expect(env.fetch).not.toHaveBeenCalled();
    });

    it.each([
      ['producto de otra empresa', 422, { items: [{ productId: 'ajeno', quantity: 1 }] }],
      ['cliente sin email', 422, { customer: { ...validCustomer, email: 'x' } }],
      ['empresa inexistente', 404, { companyId: 'nada' }],
    ])('con %s responde %i sin intento', async (_case, status, extra) => {
      expect((await start({ ...validBody, ...extra })).statusCode).toBe(status);
      expect(attemptKeys()).toEqual([]);
    });
  });

  describe('intento (#4)', () => {
    beforeEach(() => env.usePayphone());

    it('guarda el intento pendiente con carrito e importe antes de llamar al proveedor', async () => {
      let attemptAtCall: unknown;
      env.fetch.mockImplementation(async (_url: string, init: { body: string }) => {
        attemptAtCall = env.fake.docs.get(`cardPayments/${JSON.parse(init.body).clientTransactionId}`);
        return jsonReply({ paymentId: 'pp-1', payWithCard: PAY_URL });
      });

      await start();

      expect(attemptAtCall).toEqual({
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
      });
    });

    it('dos compras usan ids distintos de 50 caracteres como máximo', async () => {
      await start();
      await start();

      const ids = [prepareCall(0).body.clientTransactionId, prepareCall(1).body.clientTransactionId];
      expect(new Set(ids).size).toBe(2);
      for (const id of ids) {
        expect(id.length).toBeLessThanOrEqual(50);
        expect(id).toMatch(/^[0-9a-f]{32}$/);
        expect(env.fake.docs.has(`cardPayments/${id}`)).toBe(true);
      }
      expect(env.fake.keys('orders')).toEqual([]);
    });
  });

  describe('importe mínimo del proveedor', () => {
    const freeOrder = () => {
      env.fake.docs.set('shippingMethods/envio', { name: 'Courier', price: 0, companyId: 'c1' });
      return { ...validBody, couponCode: undefined };
    };

    it('Payphone con total 0 responde 422 amount-too-low sin intento ni proveedor', async () => {
      env.usePayphone();
      env.fake.docs.set('products/taza', { name: 'Taza', price: 0, companyId: 'c1' });

      const response = await start(freeOrder());

      expect(response.statusCode).toBe(422);
      expect(parsed(response).reason).toBe('amount-too-low');
      expect(attemptKeys()).toEqual([]);
      expect(env.fetch).not.toHaveBeenCalled();
    });

    it('Stripe con menos de 50 centavos responde 422 amount-too-low sin intento ni sesión', async () => {
      env.useStripe();
      env.fake.docs.set('products/taza', { name: 'Taza', price: 0.24, companyId: 'c1' });

      const response = await start(freeOrder());

      expect(response.statusCode).toBe(422);
      expect(parsed(response).reason).toBe('amount-too-low');
      expect(attemptKeys()).toEqual([]);
      expect(env.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('Stripe con 50 centavos justos crea la sesión', async () => {
      env.useStripe();
      env.fake.docs.set('products/taza', { name: 'Taza', price: 0.25, companyId: 'c1' });

      expect((await start(freeOrder())).statusCode).toBe(200);
      expect(env.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('credenciales (#5, #6)', () => {
    it('sin credenciales responde 422 card-unavailable sin intento ni proveedor', async () => {
      const response = await start();

      expect(response.statusCode).toBe(422);
      expect(parsed(response).reason).toBe('card-unavailable');
      expect(attemptKeys()).toEqual([]);
      expect(env.fetch).not.toHaveBeenCalled();
      expect(env.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('con credenciales incompletas responde 422 sin mostrar el token', async () => {
      env.fake.docs.set('paymentCredentials/c1', { provider: 'payphone', payphone: { token: PAYPHONE_TOKEN } });

      const response = await start();

      expect(parsed(response).reason).toBe('card-unavailable');
      expect(consoleOutput()).not.toContain(PAYPHONE_TOKEN);
    });

    it('la respuesta correcta no contiene el token', async () => {
      env.usePayphone();
      const response = await start();
      expect(response.body).not.toContain(PAYPHONE_TOKEN);
      expect(consoleOutput()).not.toContain(PAYPHONE_TOKEN);
    });

    it.each([
      ['lanza un error que cita el token', () => Promise.reject(new Error(`fetch failed Bearer ${PAYPHONE_TOKEN}`))],
      ['responde 500 citando el token', async () => jsonReply({ message: `bad token ${PAYPHONE_TOKEN}` }, 500)],
      ['responde sin payWithCard', async () => jsonReply({ echo: PAYPHONE_TOKEN })],
    ])('si Payphone %s responde 502 sin el token en la respuesta ni en los logs', async (_case, reply) => {
      env.usePayphone();
      env.fetch.mockImplementation(reply);

      const response = await start();

      expect(response.statusCode).toBe(502);
      expect(response.body).not.toContain(PAYPHONE_TOKEN);
      expect(consoleOutput()).not.toContain(PAYPHONE_TOKEN);
      expect(consoleOutput()).not.toContain('ada@example.com');
    });

    it('si Stripe falla responde 502', async () => {
      env.useStripe();
      env.stripe.checkout.sessions.create.mockRejectedValue(Object.assign(new Error('No such key sk_live_x ada@example.com'), { type: 'StripeAuthenticationError' }));

      const response = await start();

      expect(response.statusCode).toBe(502);
      expect(consoleOutput()).not.toContain('sk_live_x');
      expect(consoleOutput()).not.toContain('ada@example.com');
    });
  });
});
