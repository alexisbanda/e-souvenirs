import Stripe from 'stripe';

/**
 * Stripe con la cuenta de la plataforma (STRIPE_SECRET_KEY). Checkout Session alojada:
 * el navegador nunca decide el importe.
 */

// Versión que tipa la librería instalada: al actualizar `stripe`, tsc obliga a revisarla.
const STRIPE_API_VERSION = '2025-09-30.clover';

let client: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set.');
    client = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  }
  return client;
};

export interface CheckoutSessionInput {
  amountCents: number;
  storeName: string;
  clientTransactionId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export const createCheckoutSession = (stripe: Stripe, input: CheckoutSessionInput) =>
  stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: input.amountCents,
        product_data: { name: `Pedido ${input.storeName}`.trim() },
      },
    }],
    client_reference_id: input.clientTransactionId,
    metadata: { clientTransactionId: input.clientTransactionId },
    payment_intent_data: { metadata: { clientTransactionId: input.clientTransactionId } },
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

export const retrieveSession = (stripe: Stripe, sessionId: string) => stripe.checkout.sessions.retrieve(sessionId);

/** Verifica la firma del webhook sobre el cuerpo crudo. Lanza si no es válida. */
export const constructWebhookEvent = (stripe: Stripe, rawBody: string | Buffer, signature: string, secret: string) =>
  stripe.webhooks.constructEvent(rawBody, signature, secret);

/** clientTransactionId del intento y datos de pago de una sesión. */
export const describeSession = (session: Stripe.Checkout.Session) => ({
  clientTransactionId: session.metadata?.clientTransactionId ?? session.client_reference_id ?? null,
  paid: session.payment_status === 'paid',
  amountTotal: session.amount_total,
  paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
});
