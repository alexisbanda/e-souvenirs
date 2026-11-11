import type { Handler } from '@netlify/functions';
import type Stripe from 'stripe';
import { jsonResponse } from './order-pricing';
import { sendOrderEmails } from './order-emails';
import { finalizeCardOrder } from './payments/finalize-card-order';
import { constructWebhookEvent, describeSession } from './payments/stripe';
import { defaultDeps, errorCode, type PaymentDeps } from './payments/deps';

/**
 * Webhook de Stripe: crea la orden aunque el comprador cierre la pestaña antes de volver.
 * Verifica la firma sobre el cuerpo crudo con STRIPE_WEBHOOK_SECRET.
 */

const SESSION_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];

export const stripeWebhookHandler = (deps: PaymentDeps = defaultDeps()): Handler => async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method Not Allowed' });

  const secret = deps.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set.');
    return jsonResponse(500, { error: 'Internal server configuration error.' });
  }

  const signature = event.headers['stripe-signature'] ?? event.headers['Stripe-Signature'];
  if (!signature || !event.body) return jsonResponse(400, { error: 'Invalid signature.' });

  // La firma se calcula sobre los bytes exactos que envió Stripe.
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = constructWebhookEvent(deps.getStripe(), rawBody, signature, secret);
  } catch (error) {
    console.warn('Rejected Stripe webhook:', errorCode(error));
    return jsonResponse(400, { error: 'Invalid signature.' });
  }

  if (!SESSION_EVENTS.includes(stripeEvent.type)) return jsonResponse(200, { received: true });

  const session = stripeEvent.data.object as Stripe.Checkout.Session;
  const { clientTransactionId, paid, amountTotal, paymentIntentId } = describeSession(session);
  // Un pago asíncrono aún sin cobrar llega luego como async_payment_succeeded.
  if (!paid) return jsonResponse(200, { received: true });
  if (!clientTransactionId) {
    console.error(`Stripe session ${session.id} has no clientTransactionId.`);
    return jsonResponse(200, { received: true });
  }

  try {
    const { db, serverTimestamp } = deps.getFirebase();
    const result = await finalizeCardOrder(db, serverTimestamp, clientTransactionId, {
      provider: 'stripe',
      amountCents: amountTotal ?? NaN,
      transactionId: session.id,
      ...(paymentIntentId ? { paymentIntentId } : {}),
    });
    if (!result.ok) {
      // Reintentar no lo arreglaría: se responde 200 y queda en el log para revisarlo.
      // Con importe distinto, finalizeCardOrder ya dejó el intento en `review`.
      console.error(`Stripe session ${session.id} (card payment ${clientTransactionId}) not finalized: ${result.reason}.`);
    } else {
      // La reserva de cada correo evita duplicados si confirm-card-payment ya los envió.
      try {
        await sendOrderEmails(db, result.orderId, { fetch: deps.fetch, env: deps.env, serverTimestamp });
      } catch (error) {
        console.error('Could not send the order emails:', errorCode(error));
      }
    }
    return jsonResponse(200, { received: true });
  } catch (error) {
    // 500: Stripe reintenta el evento más tarde.
    console.error(`Could not finalize the Stripe payment ${clientTransactionId} (session ${session.id}):`, errorCode(error));
    return jsonResponse(500, { error: 'Could not process the event.' });
  }
};
