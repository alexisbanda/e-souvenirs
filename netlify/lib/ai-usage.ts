import type { Firestore } from 'firebase-admin/firestore';

const HOUR_MS = 60 * 60 * 1000;
export const DEFAULT_AI_GENERATIONS_PER_HOUR = 10;
// Margen sobre el fin de la ventana para un TTL de Firestore sobre `expiresAt`.
const EXPIRY_MARGIN_MS = 24 * HOUR_MS;

/** Lee el límite por hora. Lo que no sea un entero positivo usa el valor por defecto. */
export const getAiGenerationsPerHour = (raw = process.env.AI_GENERATIONS_PER_HOUR): number => {
  if (!raw || !/^\d+$/.test(raw.trim())) {
    return DEFAULT_AI_GENERATIONS_PER_HOUR;
  }
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_AI_GENERATIONS_PER_HOUR;
};

export type AiUsageResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

interface ConsumeOptions {
  limit?: number;
  now?: number;
}

/**
 * Consume una generación del uid en la ventana horaria actual, en una transacción
 * para que dos peticiones simultáneas no cuenten una sola. `aiUsage` no aparece en
 * firestore.rules, así que solo el servidor puede leerla o escribirla.
 */
export const consumeAiGeneration = async (
  db: Firestore,
  uid: string,
  { limit = getAiGenerationsPerHour(), now = Date.now() }: ConsumeOptions = {},
): Promise<AiUsageResult> => {
  const window = Math.floor(now / HOUR_MS);
  const windowEnd = (window + 1) * HOUR_MS;
  const ref = db.collection('aiUsage').doc(`${uid}_${window}`);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.count) || 0;

    if (count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)) };
    }

    transaction.set(ref, {
      uid,
      count: count + 1,
      windowStart: new Date(window * HOUR_MS),
      expiresAt: new Date(windowEnd + EXPIRY_MARGIN_MS),
    });
    return { allowed: true };
  });
};
