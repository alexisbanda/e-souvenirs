import type { CardProvider } from './credentials';

/**
 * Crea la orden de un pago con tarjeta ya confirmado con el proveedor.
 * Todo va en una transacción sobre el intento `cardPayments/{clientTransactionId}`
 * y la orden tiene id determinista: confirmar dos veces, aunque sea a la vez, crea una sola.
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

export const finalizeCardOrder = (
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
    if (!Number.isInteger(confirmation.amountCents) || confirmation.amountCents !== attempt.amountCents) {
      return { ok: false, status: 422, error: 'The paid amount does not match the order.', reason: 'amount-mismatch' } as const;
    }

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
