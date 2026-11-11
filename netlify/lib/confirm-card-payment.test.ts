import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmCardPaymentHandler } from './confirm-card-payment';
import { RESEND_API_URL } from './order-emails';
import {
  consoleOutput, createPaymentTestEnv, expectedItems, invoke, jsonReply, parsed, PAYPHONE_TOKEN, SELLER_EMAIL, silenceConsole, validCustomer,
} from './testing/payment-fixtures';

const TX = 'a'.repeat(32);

let env: ReturnType<typeof createPaymentTestEnv>;
const confirm = (body: unknown, token: string | null = 'good-token') => invoke(confirmCardPaymentHandler(env.deps), { body, token });
const confirmPayphone = (extra: object = {}) => confirm({ provider: 'payphone', id: '23178284', clientTransactionId: TX, ...extra });
const confirmStripe = (sessionId = 'cs_test_1') => confirm({ provider: 'stripe', sessionId });

const approved = (extra: object = {}) =>
  jsonReply({ statusCode: 3, transactionStatus: 'Approved', amount: 2300, transactionId: 23178284, clientTransactionId: TX, lastDigits: 'XX17', cardBrand: 'Visa', ...extra });

const paidSession = (extra: object = {}) => ({
  id: 'cs_test_1',
  payment_status: 'paid',
  amount_total: 2300,
  client_reference_id: TX,
  metadata: { clientTransactionId: TX },
  payment_intent: 'pi_test_1',
  ...extra,
});

const orderKeys = () => env.fake.keys('orders');
const notifications = () => env.fake.docs.get(`orders/card_${TX}`)?.notifications;
const BOTH_SENT = { buyerEmailSentAt: 'server-timestamp', sellerEmailSentAt: 'server-timestamp' };

/** Envió con Resend los dos correos de la orden, uno al comprador y otro a la tienda. */
const expectBothEmails = () => {
  const calls = env.resendCalls();
  expect(calls).toHaveLength(2);
  expect(calls.map(({ body }) => body.to[0]).sort()).toEqual([validCustomer.email, SELLER_EMAIL].sort());
  expect(calls.map(({ headers }) => headers['Idempotency-Key']).sort()).toEqual([`order-card_${TX}-buyer`, `order-card_${TX}-seller`]);
  expect(notifications()).toEqual(BOTH_SENT);
};
const expectNoOrder = () => expect(orderKeys()).toEqual([]);

describe('confirm-card-payment', () => {
  beforeEach(() => {
    env = createPaymentTestEnv();
    env.seed();
    env.usePayphone();
    env.seedAttempt(TX);
    env.fetch.mockResolvedValue(approved());
    silenceConsole();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('Payphone', () => {
    it('con statusCode 3 e importe igual crea la orden pagada (#7)', async () => {
      const response = await confirmPayphone();

      expect(response.statusCode).toBe(200);
      expect(parsed(response)).toEqual({ ok: true, orderId: `card_${TX}`, total: 23 });
      const [url, init] = env.fetch.mock.calls[0];
      expect(url).toBe('https://pay.payphonetodoesposible.com/api/button/V2/Confirm');
      expect(init.headers.Authorization).toBe(`Bearer ${PAYPHONE_TOKEN}`);
      expect(JSON.parse(init.body)).toEqual({ id: 23178284, clientTxId: TX });
      expect(orderKeys()).toEqual([`orders/card_${TX}`]);
      expect(env.fake.docs.get(`orders/card_${TX}`)).toEqual({
        userId: 'u1',
        companyId: 'c1',
        customer: validCustomer,
        items: expectedItems,
        total: 23,
        shippingMethod: 'Courier',
        shippingCost: 5,
        couponCode: 'PROMO',
        discount: 2,
        payment: { method: 'card', provider: 'payphone', transactionId: '23178284', last4: 'XX17' },
        date: 'server-timestamp',
        status: 'En producción',
      });
      expect(env.fake.docs.get(`cardPayments/${TX}`)).toMatchObject({ status: 'paid', orderId: `card_${TX}` });
      expect(response.body).not.toContain(PAYPHONE_TOKEN);
      expect(consoleOutput()).not.toContain(PAYPHONE_TOKEN);
    });

    it('con statusCode 2 marca el intento como fallido y no crea orden (#8)', async () => {
      env.fetch.mockResolvedValue(approved({ statusCode: 2, transactionStatus: 'Canceled' }));

      const response = await confirmPayphone();

      expect(response.statusCode).toBe(409);
      expect(parsed(response).reason).toBe('not-approved');
      expectNoOrder();
      expect(env.fake.docs.get(`cardPayments/${TX}`)).toMatchObject({ status: 'failed' });
    });

    it('con un importe distinto deja el intento en revisión con la referencia de Payphone, sin orden (#8)', async () => {
      env.fetch.mockResolvedValue(approved({ amount: 2299 }));

      const response = await confirmPayphone();

      expect(response.statusCode).toBe(422);
      expect(parsed(response).reason).toBe('amount-mismatch');
      expectNoOrder();
      expect(env.fake.docs.get(`cardPayments/${TX}`)).toMatchObject({
        status: 'review',
        reviewReason: 'amount-mismatch',
        transactionId: '23178284',
        paidAmountCents: 2299,
        reviewAt: 'server-timestamp',
        providerConfirmation: { transactionId: '23178284', statusCode: 3, amount: 2299 },
      });
      const log = consoleOutput();
      expect(log).toContain(TX);
      expect(log).toContain('23178284');
      expect(log).not.toContain(PAYPHONE_TOKEN);
    });

    it('sin importe en la respuesta de Payphone deja el intento en revisión con paidAmountCents null', async () => {
      env.fetch.mockResolvedValue(approved({ amount: undefined }));

      const response = await confirmPayphone();

      expect(parsed(response).reason).toBe('amount-mismatch');
      expectNoOrder();
      expect(env.fake.docs.get(`cardPayments/${TX}`)).toMatchObject({ status: 'review', paidAmountCents: null, transactionId: '23178284' });
    });

    it('un intento en revisión no crea orden aunque llegue otra confirmación con el importe correcto', async () => {
      env.fetch.mockResolvedValueOnce(approved({ amount: 2299 }));
      await confirmPayphone();

      const response = await confirmPayphone();

      expect(parsed(response).reason).toBe('amount-mismatch');
      expectNoOrder();
      expect(env.fake.docs.get(`cardPayments/${TX}`)).toMatchObject({ status: 'review', paidAmountCents: 2299 });
    });

    it('con Confirm aprobado y Firestore caído al crear la orden responde 500 y deja providerConfirmation', async () => {
      vi.spyOn(env.fake.db, 'runTransaction').mockRejectedValue(Object.assign(new Error('unavailable'), { code: 14 }));

      const response = await confirmPayphone();

      expect(response.statusCode).toBe(500);
      expectNoOrder();
      expect(env.fake.docs.get(`cardPayments/${TX}`)).toMatchObject({
        status: 'pending',
        providerConfirmation: { transactionId: '23178284', statusCode: 3, amount: 2300 },
        confirmedAt: 'server-timestamp',
      });
      const log = consoleOutput();
      expect(log).toContain(TX);
      expect(log).toContain('23178284');
      expect(log).not.toContain(PAYPHONE_TOKEN);
    });

    it('un intento fallido pasa a pagado si Payphone confirma el cobro', async () => {
      env.seedAttempt(TX, { status: 'failed', failedAt: 'server-timestamp' });

      const response = await confirmPayphone();

      expect(response.statusCode).toBe(200);
      expect(orderKeys()).toEqual([`orders/card_${TX}`]);
      expect(env.fake.docs.get(`cardPayments/${TX}`)).toMatchObject({ status: 'paid', orderId: `card_${TX}` });
    });

    it('con un clientTransactionId desconocido responde 404 sin llamar a Payphone (#8)', async () => {
      const response = await confirmPayphone({ clientTransactionId: 'b'.repeat(32) });

      expect(response.statusCode).toBe(404);
      expect(env.fetch).not.toHaveBeenCalled();
      expectNoOrder();
    });

    it('el intento de otro usuario se trata como desconocido', async () => {
      const response = await confirm({ provider: 'payphone', id: '1', clientTransactionId: TX }, 'other-token');

      expect(response.statusCode).toBe(404);
      expect(env.fetch).not.toHaveBeenCalled();
      expectNoOrder();
    });

    it('si Payphone devuelve otro clientTransactionId no crea orden', async () => {
      env.fetch.mockResolvedValue(approved({ clientTransactionId: 'otro' }));

      expect((await confirmPayphone()).statusCode).toBe(404);
      expectNoOrder();
    });

    it('si Payphone falla responde 502, sin orden ni token en los logs', async () => {
      env.fetch.mockRejectedValue(new Error(`boom ${PAYPHONE_TOKEN}`));

      const response = await confirmPayphone();

      expect(response.statusCode).toBe(502);
      expectNoOrder();
      expect(consoleOutput()).not.toContain(PAYPHONE_TOKEN);
    });

    it('confirmar dos veces seguidas crea una sola orden (#9)', async () => {
      const first = parsed(await confirmPayphone());
      const second = parsed(await confirmPayphone());

      expect(first.orderId).toBe(`card_${TX}`);
      expect(second).toEqual(first);
      expect(orderKeys()).toHaveLength(1);
    });

    it('confirmar dos veces a la vez crea una sola orden (#9)', async () => {
      const responses = await Promise.all([confirmPayphone(), confirmPayphone(), confirmPayphone()]);

      expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200]);
      expect(new Set(responses.map((response) => parsed(response).orderId))).toEqual(new Set([`card_${TX}`]));
      expect(orderKeys()).toHaveLength(1);
      expect(env.fake.writes.filter(({ path }) => path.startsWith('orders/'))).toHaveLength(1);
    });

    describe('correos del pedido (#67)', () => {
      beforeEach(() => env.useResend());

      it('tras crear la orden envía el correo al comprador y el aviso al vendedor', async () => {
        const response = await confirmPayphone();

        expect(parsed(response)).toEqual({ ok: true, orderId: `card_${TX}`, total: 23 });
        expectBothEmails();
      });

      it('confirmar varias veces, a la vez y después, envía cada correo una sola vez', async () => {
        await Promise.all([confirmPayphone(), confirmPayphone(), confirmPayphone()]);
        await confirmPayphone();

        expectBothEmails();
      });

      it('si Resend devuelve 500 responde igual, libera las marcas y el log no tiene datos personales', async () => {
        env.fetch.mockImplementation(async (url: string) =>
          url === RESEND_API_URL ? jsonReply({ message: `Invalid: ${validCustomer.email}` }, 500) : approved());

        const response = await confirmPayphone();

        expect(response.statusCode).toBe(200);
        expect(parsed(response)).toEqual({ ok: true, orderId: `card_${TX}`, total: 23 });
        expect(env.resendCalls()).toHaveLength(2);
        expect(notifications()).toEqual({});
        expect(consoleOutput()).toContain('HTTP 500');
        for (const value of [validCustomer.email, validCustomer.name, validCustomer.phone, SELLER_EMAIL]) {
          expect(consoleOutput()).not.toContain(value);
        }
      });

      it('si el pago no se aprueba no envía correos', async () => {
        env.fetch.mockResolvedValue(approved({ statusCode: 2 }));

        expect((await confirmPayphone()).statusCode).toBe(409);
        expect(env.resendCalls()).toEqual([]);
      });
    });

    it.each([
      ['sin id', { id: undefined }],
      ['con id no numérico', { id: 'abc' }],
      ['con clientTransactionId demasiado largo', { clientTransactionId: 'a'.repeat(51) }],
      ['con clientTransactionId con barra', { clientTransactionId: 'a/b' }],
    ])('responde 422 %s', async (_case, extra) => {
      expect((await confirmPayphone(extra)).statusCode).toBe(422);
      expect(env.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Stripe', () => {
    beforeEach(() => {
      env.useStripe();
      env.seedAttempt(TX, { provider: 'stripe' });
      env.stripe.checkout.sessions.retrieve.mockResolvedValue(paidSession());
    });

    it('con la sesión pagada e importe igual crea la orden con la sesión y el PaymentIntent', async () => {
      const response = await confirmStripe();

      expect(response.statusCode).toBe(200);
      expect(parsed(response)).toEqual({ ok: true, orderId: `card_${TX}`, total: 23 });
      expect(env.stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_1');
      expect(env.fake.docs.get(`orders/card_${TX}`)).toMatchObject({
        total: 23,
        discount: 2,
        status: 'En producción',
        payment: { method: 'card', provider: 'stripe', transactionId: 'cs_test_1', paymentIntentId: 'pi_test_1' },
      });
    });

    it('sin pagar responde 409 sin orden', async () => {
      env.stripe.checkout.sessions.retrieve.mockResolvedValue(paidSession({ payment_status: 'unpaid' }));

      expect((await confirmStripe()).statusCode).toBe(409);
      expectNoOrder();
    });

    it('con importe distinto responde 422, sin orden y con el intento en revisión', async () => {
      env.stripe.checkout.sessions.retrieve.mockResolvedValue(paidSession({ amount_total: 1 }));

      expect((await confirmStripe()).statusCode).toBe(422);
      expectNoOrder();
      expect(env.fake.docs.get(`cardPayments/${TX}`)).toMatchObject({
        status: 'review',
        transactionId: 'cs_test_1',
        paymentIntentId: 'pi_test_1',
        paidAmountCents: 1,
      });
    });

    it('con una sesión que Stripe no conoce responde 404', async () => {
      env.stripe.checkout.sessions.retrieve.mockRejectedValue(Object.assign(new Error('No such checkout.session'), { code: 'resource_missing' }));

      expect((await confirmStripe()).statusCode).toBe(404);
      expectNoOrder();
    });

    it('la sesión de otro usuario se trata como desconocida', async () => {
      const response = await confirm({ provider: 'stripe', sessionId: 'cs_test_1' }, 'other-token');

      expect(response.statusCode).toBe(404);
      expectNoOrder();
    });

    it('confirmar dos veces a la vez crea una sola orden', async () => {
      const responses = await Promise.all([confirmStripe(), confirmStripe()]);

      expect(responses.map((response) => parsed(response).orderId)).toEqual([`card_${TX}`, `card_${TX}`]);
      expect(orderKeys()).toHaveLength(1);
    });

    it('tras crear la orden envía los dos correos una sola vez aunque se confirme dos veces a la vez (#67)', async () => {
      env.useResend();

      const responses = await Promise.all([confirmStripe(), confirmStripe()]);

      expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
      expectBothEmails();
    });

    it('rechaza un sessionId mal formado', async () => {
      expect((await confirmStripe('../x')).statusCode).toBe(422);
      expect(env.stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });
  });

  it('responde 401 sin sesión y 422 con un proveedor desconocido', async () => {
    expect((await confirm({ provider: 'payphone', id: '1', clientTransactionId: TX }, null)).statusCode).toBe(401);
    expect((await confirm({ provider: 'paypal' })).statusCode).toBe(422);
    expectNoOrder();
  });
});
