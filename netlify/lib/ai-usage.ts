import type { Firestore } from 'firebase-admin/firestore';

const HOUR_MS = 60 * 60 * 1000;
export const DEFAULT_AI_GENERATIONS_PER_HOUR = 10;
export const DEFAULT_COMPANY_AI_GENERATIONS_PER_HOUR = 100;
// Margen sobre el fin de la ventana para un TTL de Firestore sobre `expiresAt`.
const EXPIRY_MARGIN_MS = 24 * HOUR_MS;

/** Lo que no sea un entero positivo usa el valor por defecto. */
const parseLimit = (raw: string | undefined, fallback: number): number => {
  if (!raw || !/^\d+$/.test(raw.trim())) {
    return fallback;
  }
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

/** Límite por usuario y hora. */
export const getAiGenerationsPerHour = (raw = process.env.AI_GENERATIONS_PER_HOUR): number =>
  parseLimit(raw, DEFAULT_AI_GENERATIONS_PER_HOUR);

/** Límite por empresa y hora, entre todos sus usuarios. */
export const getCompanyAiGenerationsPerHour = (raw = process.env.AI_COMPANY_GENERATIONS_PER_HOUR): number =>
  parseLimit(raw, DEFAULT_COMPANY_AI_GENERATIONS_PER_HOUR);

export type AiUsageScope = 'user' | 'company';

export type AiUsageResult = { allowed: true } | { allowed: false; scope: AiUsageScope; retryAfterSeconds: number };

interface ConsumeOptions {
  limit?: number;
  companyLimit?: number;
  now?: number;
}

/**
 * Consume una generación del uid y de la empresa en la ventana horaria actual. El
 * límite por usuario no basta: crear cuentas es gratis, y el de empresa acota el
 * gasto aunque las peticiones lleguen de muchas cuentas.
 *
 * Va en una transacción para que dos peticiones simultáneas no cuenten una sola y
 * para que un rechazo no gaste cupo del otro contador. `aiUsage` no aparece en
 * firestore.rules, así que solo el servidor puede leerla o escribirla.
 */
const usageRefs = (db: Firestore, uid: string, companyId: string, window: number) => ({
  userRef: db.collection('aiUsage').doc(`${uid}_${window}`),
  companyRef: db.collection('aiUsage').doc(`company_${companyId}_${window}`),
});

export const consumeAiGeneration = async (
  db: Firestore,
  uid: string,
  companyId: string,
  { limit = getAiGenerationsPerHour(), companyLimit = getCompanyAiGenerationsPerHour(), now = Date.now() }: ConsumeOptions = {},
): Promise<AiUsageResult> => {
  const window = Math.floor(now / HOUR_MS);
  const windowEnd = (window + 1) * HOUR_MS;
  const { userRef, companyRef } = usageRefs(db, uid, companyId, window);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd - now) / 1000));
  const timestamps = {
    windowStart: new Date(window * HOUR_MS),
    expiresAt: new Date(windowEnd + EXPIRY_MARGIN_MS),
  };

  return db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const companySnapshot = await transaction.get(companyRef);
    const userCount = Number(userSnapshot.data()?.count) || 0;
    const companyCount = Number(companySnapshot.data()?.count) || 0;

    if (userCount >= limit) {
      return { allowed: false, scope: 'user', retryAfterSeconds };
    }
    if (companyCount >= companyLimit) {
      return { allowed: false, scope: 'company', retryAfterSeconds };
    }

    transaction.set(userRef, { uid, count: userCount + 1, ...timestamps });
    transaction.set(companyRef, { companyId, count: companyCount + 1, ...timestamps });
    return { allowed: true };
  });
};

/**
 * Devuelve una generación que no llegó a lanzarse. `now` debe ser el mismo que se
 * usó al consumirla, para descontarla de esa ventana aunque ya haya empezado otra.
 */
export const releaseAiGeneration = async (
  db: Firestore,
  uid: string,
  companyId: string,
  { now = Date.now() }: { now?: number } = {},
): Promise<void> => {
  const { userRef, companyRef } = usageRefs(db, uid, companyId, Math.floor(now / HOUR_MS));

  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const companySnapshot = await transaction.get(companyRef);

    for (const [ref, snapshot] of [[userRef, userSnapshot], [companyRef, companySnapshot]] as const) {
      const data = snapshot.data();
      if (data) {
        transaction.set(ref, { ...data, count: Math.max(0, (Number(data.count) || 0) - 1) });
      }
    }
  });
};
