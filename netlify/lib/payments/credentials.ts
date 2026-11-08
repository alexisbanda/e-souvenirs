/**
 * Credenciales de cobro con tarjeta de cada tienda, en `paymentCredentials/{companyId}`.
 * Las reglas niegan esa colección a cualquier cliente: solo la lee el servidor.
 * Nunca se loguea ni se devuelve el documento: el token de Payphone es secreto.
 */

export interface PayphoneCredentials {
  token: string;
  storeId: string;
  /** IVA incluido en los precios (p. ej. 0.15). Sin él, todo el importe va sin IVA. */
  taxRate?: number;
}

export type CardCredentials =
  | { provider: 'payphone'; payphone: PayphoneCredentials }
  | { provider: 'stripe' };

export type CardProvider = CardCredentials['provider'];

export const PAYMENT_CREDENTIALS_COLLECTION = 'paymentCredentials';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

export const isValidTaxRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1;

/** Interpreta el documento guardado; null si no hay proveedor válido. */
export const parseCardCredentials = (data: Record<string, unknown> | undefined): CardCredentials | null => {
  if (!data) return null;
  if (data.provider === 'stripe') return { provider: 'stripe' };
  if (data.provider !== 'payphone') return null;

  const payphone = data.payphone as Record<string, unknown> | undefined;
  if (!payphone || !isNonEmptyString(payphone.token) || !isNonEmptyString(payphone.storeId)) return null;
  const { taxRate } = payphone;
  if (taxRate !== undefined && taxRate !== null && !isValidTaxRate(taxRate)) return null;
  return {
    provider: 'payphone',
    payphone: {
      token: payphone.token,
      storeId: payphone.storeId,
      ...(isValidTaxRate(taxRate) ? { taxRate } : {}),
    },
  };
};

/** Lee las credenciales de la tienda. null si no tiene tarjeta configurada. */
export const getCardCredentials = async (db: FirebaseFirestore.Firestore, companyId: string): Promise<CardCredentials | null> => {
  const snapshot = await db.collection(PAYMENT_CREDENTIALS_COLLECTION).doc(companyId).get();
  if (!snapshot.exists) return null;
  const credentials = parseCardCredentials(snapshot.data());
  if (!credentials) {
    // Solo el id de la tienda: el documento contiene el token.
    console.error(`Invalid payment credentials for company ${companyId}.`);
  }
  return credentials;
};
