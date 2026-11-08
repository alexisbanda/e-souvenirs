import type { CardProvider } from './credentials';

/**
 * Crea la orden de un pago con tarjeta ya confirmado con el proveedor.
 * Todo va en una transacción sobre el intento `cardPayments/{clientTransactionId}`
 * y la orden tiene id determinista: confirmar dos veces, aunque sea a la vez, crea una sola.
 *
 * Si el proveedor cobró un importe distinto (o no lo informó), el cobro ya está hecho:
 * el intento pasa a `review` con la referencia del proveedor para que la tienda lo
 * revise o reembolse, y no se crea orden.
 */

export const CARD_PAYMENTS_COLLECTION = 'cardPayments';

export const cardOrderId = (clientTransactionId: string) => `card_${clientTransactionId}`;

export interface CardPaymentConfirmation {
  provider: CardProvider;
  /** Importe cobrado según el proveedor, en centavos. */
  amountCents: number;
  /** Payphone: transactionId; Stripe: id de la Checkout Session. */
  transactionId: string;
  paymentIntentId?: string;
  last4?: string;
}

export type FinalizeResult =
  | { ok: true; orderId: string; total: number }
  | { ok: false; status: number; error: string; reason: string };

const amountMismatch = () =>
  ({ ok: false, status: 422, error: 'The paid amount does not match the order.', reason: 'amount-mismatch' }) as const;

export const finalizeCardOrder = async (
  db: FirebaseFirestore.Firestore,
  serverTimestamp: () => unknown,
  clientTransactionId: string,
  confirmation: CardPaymentConfirmation,
): Promise<FinalizeResult> => {
  const result = await finalizeInTransaction(db, serverTimestamp, clientTransactionId, confirmation);
  if (!result.ok && result.reason === 'amount-mismatch') {
    console.error(
      `Card payment ${clientTransactionId} (${confirmation.provider} ${confirmation.transactionId}) needs review: amount-mismatch.`,
    );
  }
  return result;
};

const finalizeInTransaction = (
  db: FirebaseFirestore.Firestore,
  serverTimestamp: () => unknown,
  clientTransactionId: string,
  confirmation: CardPaymentConfirmation,
): Promise<FinalizeResult> =>
  db.runTransaction(async (transaction) => {
    const attemptRef = db.collection(CARD_PAYMENTS_COLLECTION).doc(clientTransactionId);
    const snapshot = await transaction.get(attemptRef);
    const attempt = snapshot.exists ? snapshot.data() : undefined;
    if (!attempt) {
      return { ok: false, status: 404, error: 'Card payment not found.', reason: 'not-found' } as const;
    }
    if (attempt.status === 'paid' && typeof attempt.orderId === 'string') {
      return { ok: true, orderId: attempt.orderId, total: attempt.total } as const;
    }
    if (attempt.provider !== confirmation.provider) {
      return { ok: false, status: 404, error: 'Card payment not found.', reason: 'not-found' } as const;
    }
    // Ya revisado: no se crea orden aunque llegue otra confirmación.
    if (attempt.status === 'review') return amountMismatch();
    if (!Number.isInteger(confirmation.amountCents) || confirmation.amountCents !== attempt.amountCents) {
      // Se devuelve sin lanzar para que la transacción aplique el cambio a `review`.
      transaction.update(attemptRef, {
        status: 'review',
        reviewReason: 'amount-mismatch',
        transactionId: confirmation.transactionId,
        ...(confirmation.paymentIntentId ? { paymentIntentId: confirmation.paymentIntentId } : {}),
        paidAmountCents: Number.isInteger(confirmation.amountCents) ? confirmation.amountCents : null,
        reviewAt: serverTimestamp(),
      });
      return amountMismatch();
    }
    // Un intento `failed` (p. ej. el comprador volvió por la URL de cancelación) puede
    // pasar a `paid`: si el proveedor confirma el cobro, manda su confirmación.

    const orderId = cardOrderId(clientTransactionId);
    const payment = {
      method: 'card',
      provider: confirmation.provider,
      transactionId: confirmation.transactionId,
      ...(confirmation.paymentIntentId ? { paymentIntentId: confirmation.paymentIntentId } : {}),
      ...(confirmation.last4 ? { last4: confirmation.last4 } : {}),
    };
    transaction.set(db.collection('orders').doc(orderId), {
      userId: attempt.userId,
      companyId: attempt.companyId,
      customer: attempt.customer,
      items: attempt.items,
      total: attempt.total,
      shippingMethod: attempt.shippingMethod,
      shippingCost: attempt.shippingCost,
      couponCode: attempt.couponCode,
      discount: attempt.discount,
      payment,
      date: serverTimestamp(),
      // Ya está pagada.
      status: 'En producción',
    });
    transaction.update(attemptRef, {
      status: 'paid',
      orderId,
      transactionId: confirmation.transactionId,
      paidAt: serverTimestamp(),
    });
    return { ok: true, orderId, total: attempt.total } as const;
  });
