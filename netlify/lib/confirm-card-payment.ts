import type { Handler } from '@netlify/functions';
import { jsonResponse } from './order-pricing';
import { sendOrderEmails } from './order-emails';
import { getCardCredentials } from './payments/credentials';
import { CARD_PAYMENTS_COLLECTION, finalizeCardOrder, type FinalizeResult } from './payments/finalize-card-order';
import { confirmPayment, PAYPHONE_APPROVED, PAYPHONE_CANCELLED } from './payments/payphone';
import { describeSession, retrieveSession } from './payments/stripe';
import { authenticate, defaultDeps, errorCode, isResponse, type PaymentDeps } from './payments/deps';

/**
 * Confirma con el proveedor un pago con tarjeta del usuario y crea su orden.
 * Es idempotente: confirmar otra vez devuelve la misma orden.
 */

const CLIENT_TRANSACTION_ID = /^[A-Za-z0-9_-]{1,50}$/;
const STRIPE_SESSION_ID = /^cs_[A-Za-z0-9_]{1,250}$/;

const notFound = () => jsonResponse(404, { error: 'Card payment not found.', reason: 'not-found' });
const notApproved = () => jsonResponse(409, { error: 'The payment was not approved.', reason: 'not-approved' });
const invalidInput = (error: string) => jsonResponse(422, { error });
const confirmFailed = () => jsonResponse(500, { error: 'Could not confirm the card payment.' });
const providerError = () => jsonResponse(502, { error: 'Could not confirm the payment with the provider.' });

const finalizeResponse = (result: FinalizeResult) =>
  result.ok
    ? jsonResponse(200, { ok: true, orderId: result.orderId, total: result.total })
    : jsonResponse(result.status, { error: result.error, reason: result.reason });

/** El id que Payphone añade a la URL de vuelta es un entero. */
const parsePayphoneId = (value: unknown): number | null => {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d{1,15}$/.test(text)) return null;
  return Number(text);
};

export const confirmCardPaymentHandler = (deps: PaymentDeps = defaultDeps()): Handler => async (event) => {
  const request = await authenticate(event, deps);
  if (isResponse(request)) return request;
  const { body, uid, db, serverTimestamp } = request;

  /** Con la orden creada (o ya creada), envía sus correos; la reserva evita duplicados. Nunca cambia la respuesta. */
  const finalized = async (result: FinalizeResult) => {
    if (result.ok) {
      try {
        await sendOrderEmails(db, result.orderId, { fetch: deps.fetch, env: deps.env, serverTimestamp });
      } catch (error) {
        console.error('Could not send the order emails:', errorCode(error));
      }
    }
    return finalizeResponse(result);
  };

  const loadAttempt = async (clientTransactionId: string, provider: string) => {
    const snapshot = await db.collection(CARD_PAYMENTS_COLLECTION).doc(clientTransactionId).get();
    const attempt = snapshot.exists ? snapshot.data() : undefined;
    // El intento de otro usuario se trata como inexistente.
    return attempt && attempt.userId === uid && attempt.provider === provider ? attempt : null;
  };

  try {
    if (body.provider === 'payphone') {
      const id = parsePayphoneId(body.id);
      const { clientTransactionId } = body;
      if (id === null) return invalidInput("Invalid 'id'.");
      if (typeof clientTransactionId !== 'string' || !CLIENT_TRANSACTION_ID.test(clientTransactionId)) {
        return invalidInput("Invalid 'clientTransactionId'.");
      }

      const attempt = await loadAttempt(clientTransactionId, 'payphone');
      if (!attempt) return notFound();
      if (attempt.status === 'paid') return jsonResponse(200, { ok: true, orderId: attempt.orderId, total: attempt.total });

      const credentials = await getCardCredentials(db, attempt.companyId);
      if (credentials?.provider !== 'payphone') {
        return jsonResponse(422, { error: 'Card payments are not available for this company.', reason: 'card-unavailable' });
      }

      let confirmed;
      try {
        confirmed = await confirmPayment(credentials.payphone, { id, clientTxId: clientTransactionId }, deps.fetch);
      } catch (error) {
        console.error('Could not confirm the payphone payment:', errorCode(error));
        return providerError();
      }
      if (confirmed.clientTransactionId && confirmed.clientTransactionId !== clientTransactionId) return notFound();
      if (confirmed.statusCode === PAYPHONE_CANCELLED) {
        await db.collection(CARD_PAYMENTS_COLLECTION).doc(clientTransactionId).update({ status: 'failed', failedAt: serverTimestamp() });
        return notApproved();
      }
      if (confirmed.statusCode !== PAYPHONE_APPROVED) return notApproved();

      // V2/Confirm ya liquidó el cobro: si algo falla desde aquí, queda rastro para reembolsar o reprocesar.
      try {
        await db.collection(CARD_PAYMENTS_COLLECTION).doc(clientTransactionId).update({
          providerConfirmation: {
            transactionId: confirmed.transactionId,
            statusCode: confirmed.statusCode,
            amount: Number.isFinite(confirmed.amount) ? confirmed.amount : null,
          },
          confirmedAt: serverTimestamp(),
        });
        return finalized(await finalizeCardOrder(db, serverTimestamp, clientTransactionId, {
          provider: 'payphone',
          amountCents: confirmed.amount,
          transactionId: confirmed.transactionId,
          last4: confirmed.lastDigits?.slice(-4),
        }));
      } catch (error) {
        console.error(
          `Could not finalize the approved payphone payment ${clientTransactionId} (transaction ${confirmed.transactionId}):`,
          errorCode(error),
        );
        return confirmFailed();
      }
    }

    if (body.provider === 'stripe') {
      const { sessionId } = body;
      if (typeof sessionId !== 'string' || !STRIPE_SESSION_ID.test(sessionId)) return invalidInput("Invalid 'sessionId'.");

      let session;
      try {
        session = await retrieveSession(deps.getStripe(), sessionId);
      } catch (error) {
        if ((error as { code?: string }).code === 'resource_missing') return notFound();
        console.error('Could not retrieve the Stripe session:', errorCode(error));
        return providerError();
      }
      const { clientTransactionId, paid, amountTotal, paymentIntentId } = describeSession(session);
      if (!clientTransactionId || !CLIENT_TRANSACTION_ID.test(clientTransactionId)) return notFound();

      const attempt = await loadAttempt(clientTransactionId, 'stripe');
      if (!attempt) return notFound();
      if (attempt.status === 'paid') return jsonResponse(200, { ok: true, orderId: attempt.orderId, total: attempt.total });
      if (!paid) return notApproved();

      try {
        return finalized(await finalizeCardOrder(db, serverTimestamp, clientTransactionId, {
          provider: 'stripe',
          amountCents: amountTotal ?? NaN,
          transactionId: session.id,
          ...(paymentIntentId ? { paymentIntentId } : {}),
        }));
      } catch (error) {
        // El webhook de Stripe reintentará la misma sesión.
        console.error(`Could not finalize the paid Stripe payment ${clientTransactionId} (session ${session.id}):`, errorCode(error));
        return confirmFailed();
      }
    }

    return invalidInput("'provider' must be 'payphone' or 'stripe'.");
  } catch (error) {
    console.error('Could not confirm the card payment:', errorCode(error));
    return confirmFailed();
  }
};
