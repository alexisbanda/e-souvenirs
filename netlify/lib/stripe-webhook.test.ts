import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { stripeWebhookHandler } from './stripe-webhook';
import { createPaymentTestEnv, invoke, silenceConsole, WEBHOOK_SECRET } from './testing/payment-fixtures';

const TX = 'c'.repeat(32);
const webhooks = new Stripe('sk_test_dummy').webhooks;

let env: ReturnType<typeof createPaymentTestEnv>;

const sessionEvent = (type = 'checkout.session.completed', session: object = {}) => JSON.stringify({
  id: 'evt_1',
  object: 'event',
  type,
  data: {
    object: {
      id: 'cs_test_1',
      object: 'checkout.session',
      payment_status: 'paid',
      amount_total: 2300,
      client_reference_id: TX,
      metadata: { clientTransactionId: TX },
      payment_intent: 'pi_test_1',
      ...session,
    },
  },
});

const send = (payload: string, { secret = WEBHOOK_SECRET, signature = undefined as string | undefined, base64 = false } = {}) =>
  invoke(stripeWebhookHandler(env.deps), {
    token: null,
    rawBody: base64 ? Buffer.from(payload).toString('base64') : payload,
    isBase64Encoded: base64,
    headers: { 'stripe-signature': signature ?? webhooks.generateTestHeaderString({ payload, secret }) },
  });

const orderKeys = () => env.fake.keys('orders');

describe('stripe-webhook', () => {
  beforeEach(() => {
    env = createPaymentTestEnv();
    env.seed();
    env.useStripe();
    env.seedAttempt(TX, { provider: 'stripe' });
    silenceConsole();
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['firmada con otro secreto', { secret: 'whsec_otro' }],
    ['con una firma falsa', { signature: 't=1,v1=deadbeef' }],
  ])('con una petición %s responde 400 sin escribir nada (#10)', async (_case, options) => {
    const response = await send(sessionEvent(), options);

    expect(response.statusCode).toBe(400);
    expect(env.fake.writes).toEqual([]);
  });

  it('sin firma responde 400 sin escribir nada', async () => {
    const response = await invoke(stripeWebhookHandler(env.deps), { token: null, rawBody: sessionEvent() });

    expect(response.statusCode).toBe(400);
    expect(env.fake.writes).toEqual([]);
  });

  it('un cuerpo modificado tras firmar responde 400', async () => {
    const payload = sessionEvent();
    const signature = webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

    const response = await send(payload.replace('2300', '1'), { signature });

    expect(response.statusCode).toBe(400);
    expect(env.fake.writes).toEqual([]);
  });

  it('checkout.session.completed crea la orden con la sesión y el PaymentIntent (#11)', async () => {
    const response = await send(sessionEvent());

    expect(response.statusCode).toBe(200);
    expect(orderKeys()).toEqual([`orders/card_${TX}`]);
    expect(env.fake.docs.get(`orders/card_${TX}`)).toMatchObject({
      userId: 'u1',
      total: 23,
      discount: 2,
      status: 'En producción',
      payment: { method: 'card', provider: 'stripe', transactionId: 'cs_test_1', paymentIntentId: 'pi_test_1' },
    });
  });

  it('recibido dos veces, incluso a la vez, crea una sola orden (#11)', async () => {
    await send(sessionEvent());
    await Promise.all([send(sessionEvent()), send(sessionEvent())]);

    expect(orderKeys()).toHaveLength(1);
    expect(env.fake.writes.filter(({ path }) => path.startsWith('orders/'))).toHaveLength(1);
  });

  it('verifica la firma sobre el cuerpo en base64', async () => {
    const response = await send(sessionEvent(), { base64: true });

    expect(response.statusCode).toBe(200);
    expect(orderKeys()).toHaveLength(1);
  });

  it.each([
    ['otro tipo de evento', sessionEvent('payment_intent.succeeded')],
    ['una sesión sin pagar', sessionEvent('checkout.session.completed', { payment_status: 'unpaid' })],
    ['un importe distinto', sessionEvent('checkout.session.completed', { amount_total: 1 })],
    ['un intento desconocido', sessionEvent('checkout.session.completed', { metadata: { clientTransactionId: 'nada' } })],
  ])('con %s responde 200 sin crear orden', async (_case, payload) => {
    const response = await send(payload);

    expect(response.statusCode).toBe(200);
    expect(orderKeys()).toEqual([]);
  });

  it('si Firestore falla responde 500 para que Stripe reintente', async () => {
    env.fake.failures.write = Object.assign(new Error('unavailable'), { code: 14 });

    expect((await send(sessionEvent())).statusCode).toBe(500);
  });

  it('sin STRIPE_WEBHOOK_SECRET responde 500 sin escribir', async () => {
    delete env.env.STRIPE_WEBHOOK_SECRET;

    expect((await send(sessionEvent())).statusCode).toBe(500);
    expect(env.fake.writes).toEqual([]);
  });
});
