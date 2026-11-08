import type { Handler } from '@netlify/functions';
import { failureResponse, jsonResponse, orderFields, priceOrder } from './order-pricing';
import { getCardCredentials, type CardProvider } from './payments/credentials';
import { CARD_PAYMENTS_COLLECTION } from './payments/finalize-card-order';
import { preparePayment } from './payments/payphone';
import { createCheckoutSession } from './payments/stripe';
import { authenticate, defaultDeps, errorCode, getSiteUrl, isResponse, type PaymentDeps } from './payments/deps';

/**
 * Inicia un pago con tarjeta: calcula el importe en el servidor, guarda el intento
 * y devuelve la URL del proveedor. La orden se crea al confirmar el pago.
 */
/** Importe mínimo que acepta cada proveedor, en centavos (Stripe: 0,50 USD). */
const MIN_AMOUNT_CENTS: Record<CardProvider, number> = { payphone: 1, stripe: 50 };

export const createCardPaymentHandler = (deps: PaymentDeps = defaultDeps()): Handler => async (event) => {
  const request = await authenticate(event, deps);
  if (isResponse(request)) return request;
  const { body, uid, db, serverTimestamp } = request;

  try {
    const result = await priceOrder(db, body);
    if (!result.ok) return failureResponse(result);
    const { priced } = result;

    const credentials = await getCardCredentials(db, priced.companyId);
    if (!credentials) {
      return jsonResponse(422, { error: 'Card payments are not available for this company.', reason: 'card-unavailable' });
    }
    if (priced.amounts.total < MIN_AMOUNT_CENTS[credentials.provider]) {
      return jsonResponse(422, { error: 'The total is below the minimum for card payments.', reason: 'amount-too-low' });
    }

    const siteUrl = getSiteUrl(deps.env);
    if (!siteUrl || !priced.company.slug) {
      console.error('Cannot build the card payment return URL: SITE_URL/URL or the company slug is missing.');
      return jsonResponse(500, { error: 'Internal server configuration error.' });
    }
    const checkoutUrl = `${siteUrl}/${encodeURIComponent(priced.company.slug)}/checkout`;

    const clientTransactionId = deps.randomId();
    const amountCents = priced.amounts.total;
    // El intento se guarda antes de ir a pagar: la confirmación solo se fía de él.
    await db.collection(CARD_PAYMENTS_COLLECTION).doc(clientTransactionId).set({
      userId: uid,
      provider: credentials.provider,
      amountCents,
      ...orderFields(priced),
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    let url: string | null;
    try {
      if (credentials.provider === 'payphone') {
        const prepared = await preparePayment(credentials.payphone, {
          amountCents,
          clientTransactionId,
          reference: `Pedido ${priced.company.name}`.trim().slice(0, 100),
          responseUrl: checkoutUrl,
          cancellationUrl: `${checkoutUrl}?status=cancel`,
        }, deps.fetch);
        url = prepared.payWithCard;
      } else {
        const session = await createCheckoutSession(deps.getStripe(), {
          amountCents,
          storeName: priced.company.name,
          clientTransactionId,
          customerEmail: priced.customer.email,
          successUrl: `${checkoutUrl}?status=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${checkoutUrl}?status=cancel`,
        });
        url = session.url;
      }
    } catch (error) {
      console.error(`Could not start the ${credentials.provider} payment:`, errorCode(error));
      return jsonResponse(502, { error: 'Could not start the card payment.' });
    }
    if (!url) {
      console.error(`The ${credentials.provider} payment has no URL.`);
      return jsonResponse(502, { error: 'Could not start the card payment.' });
    }
    return jsonResponse(200, { url });
  } catch (error) {
    console.error('Could not create the card payment:', errorCode(error));
    return jsonResponse(500, { error: 'Could not create the card payment.' });
  }
};
