import type { PayphoneCredentials } from './credentials';

/**
 * Botón de pago de Payphone por redirección.
 * Doc: https://docs.payphone.app/boton-de-pago (Prepare y V2/Confirm).
 * Los importes van en centavos. Los errores nunca incluyen el token ni la respuesta.
 */

export const PAYPHONE_API_URL = 'https://pay.payphonetodoesposible.com/api/button';

/** Código de Payphone para una transacción aprobada; 2 es cancelada. */
export const PAYPHONE_APPROVED = 3;
export const PAYPHONE_CANCELLED = 2;

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export class PayphoneError extends Error {
  constructor(operation: string, readonly status?: number) {
    super(`Payphone ${operation} failed${status ? ` with status ${status}` : ''}.`);
    this.name = 'PayphoneError';
  }
}

export interface TaxSplit {
  amountWithoutTax: number;
  amountWithTax: number;
  tax: number;
}

/**
 * Desglosa el total para Payphone. Sin taxRate todo va como amountWithoutTax.
 * Con taxRate, los precios incluyen IVA: base = round(total / (1 + rate)) e IVA = total − base.
 * La suma siempre es el total.
 */
export const splitTax = (amountCents: number, taxRate?: number): TaxSplit => {
  if (!taxRate) return { amountWithoutTax: amountCents, amountWithTax: 0, tax: 0 };
  const amountWithTax = Math.round(amountCents / (1 + taxRate));
  return { amountWithoutTax: 0, amountWithTax, tax: amountCents - amountWithTax };
};

export interface PreparePaymentInput {
  amountCents: number;
  clientTransactionId: string;
  reference: string;
  responseUrl: string;
  cancellationUrl: string;
}

export interface PreparedPayment {
  paymentId: string;
  payWithCard: string;
}

const post = async (fetchImpl: FetchLike, operation: string, token: string, path: string, body: object) => {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(`${PAYPHONE_API_URL}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    // El error de red podría citar la petición: no se propaga.
    throw new PayphoneError(operation);
  }
  if (!response.ok) throw new PayphoneError(operation, response.status);
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new PayphoneError(operation, response.status);
  }
};

export const preparePayment = async (
  credentials: PayphoneCredentials,
  input: PreparePaymentInput,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<PreparedPayment> => {
  const data = await post(fetchImpl, 'Prepare', credentials.token, 'Prepare', {
    amount: input.amountCents,
    ...splitTax(input.amountCents, credentials.taxRate),
    currency: 'USD',
    clientTransactionId: input.clientTransactionId,
    storeId: credentials.storeId,
    reference: input.reference,
    responseUrl: input.responseUrl,
    cancellationUrl: input.cancellationUrl,
  });
  if (typeof data.payWithCard !== 'string' || !data.payWithCard) throw new PayphoneError('Prepare');
  return { paymentId: String(data.paymentId ?? ''), payWithCard: data.payWithCard };
};

export interface ConfirmedPayment {
  statusCode: number;
  transactionStatus?: string;
  amount: number;
  transactionId: string;
  clientTransactionId?: string;
  cardBrand?: string;
  lastDigits?: string;
}

export const confirmPayment = async (
  credentials: Pick<PayphoneCredentials, 'token'>,
  input: { id: number; clientTxId: string },
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<ConfirmedPayment> => {
  const data = await post(fetchImpl, 'Confirm', credentials.token, 'V2/Confirm', { id: input.id, clientTxId: input.clientTxId });
  if (typeof data.statusCode !== 'number') throw new PayphoneError('Confirm');
  const optionalString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  return {
    statusCode: data.statusCode,
    transactionStatus: optionalString(data.transactionStatus),
    amount: typeof data.amount === 'number' ? data.amount : NaN,
    transactionId: data.transactionId === undefined || data.transactionId === null ? String(input.id) : String(data.transactionId),
    clientTransactionId: optionalString(data.clientTransactionId),
    cardBrand: optionalString(data.cardBrand),
    lastDigits: optionalString(data.lastDigits),
  };
};
