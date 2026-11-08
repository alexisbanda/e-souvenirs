import { randomBytes } from 'node:crypto';
import type { HandlerEvent } from '@netlify/functions';
import type Stripe from 'stripe';
import { getFirebaseAdmin } from '../firebase-admin';
import { getBearerToken, verifyIdToken, type IdTokenVerifier } from '../verify-id-token';
import { isPlainObject, jsonResponse } from '../order-pricing';
import type { FetchLike } from './payphone';
import { getStripe } from './stripe';

/** Lo que las funciones de pago toman del entorno; los tests lo sustituyen. */
export interface PaymentDeps {
  getFirebase: () => { db: FirebaseFirestore.Firestore; auth: IdTokenVerifier; serverTimestamp: () => unknown };
  getStripe: () => Stripe;
  fetch: FetchLike;
  /** clientTransactionId: Payphone admite hasta 50 caracteres. */
  randomId: () => string;
  env: Record<string, string | undefined>;
}

export const defaultDeps = (): PaymentDeps => ({
  getFirebase: () => {
    const admin = getFirebaseAdmin();
    return {
      db: admin.firestore(),
      auth: admin.auth(),
      serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
    };
  },
  getStripe,
  fetch: fetch as unknown as FetchLike,
  randomId: () => randomBytes(16).toString('hex'),
  env: process.env,
});

export type HttpResponse = ReturnType<typeof jsonResponse>;

export type AuthenticatedRequest = {
  body: Record<string, unknown>;
  uid: string;
  db: FirebaseFirestore.Firestore;
  serverTimestamp: () => unknown;
};

/** Método, JSON y sesión, igual que create-order. Devuelve la respuesta de error o la petición. */
export const authenticate = async (event: HandlerEvent, deps: PaymentDeps): Promise<HttpResponse | AuthenticatedRequest> => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method Not Allowed' });

  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload.' });
  }
  if (!isPlainObject(body)) return jsonResponse(400, { error: 'Invalid JSON payload.' });

  const idToken = getBearerToken(event.headers);
  if (!idToken) return jsonResponse(401, { error: 'Authentication required.' });

  let firebase: ReturnType<PaymentDeps['getFirebase']>;
  try {
    firebase = deps.getFirebase();
  } catch (error) {
    console.error('Could not initialize Firebase Admin SDK:', (error as Error).message);
    return jsonResponse(500, { error: 'Internal server configuration error.' });
  }

  let uid: string | null;
  try {
    uid = await verifyIdToken(idToken, firebase.auth);
  } catch (error) {
    console.error('Could not verify the Firebase ID token:', (error as { code?: string }).code ?? (error as Error).message);
    return jsonResponse(503, { error: 'Could not verify the session.' });
  }
  if (!uid) return jsonResponse(401, { error: 'Authentication required.' });

  return { body, uid, db: firebase.db, serverTimestamp: firebase.serverTimestamp };
};

export const isResponse = (value: HttpResponse | AuthenticatedRequest): value is HttpResponse => 'statusCode' in value;

/** Origen de las URLs de vuelta. Nunca sale de las cabeceras de la petición. */
export const getSiteUrl = (env: PaymentDeps['env']): string | null => {
  const url = env.SITE_URL || env.URL;
  return url ? url.replace(/\/+$/, '') : null;
};

/** Para logs: tipo o código del error, nunca el mensaje (podría citar datos o credenciales). */
export const errorCode = (error: unknown): string => {
  const { name, code, type, message } = (error ?? {}) as { name?: string; code?: string | number; type?: string; message?: string };
  // Los mensajes de PayphoneError los escribe payphone.ts y no llevan datos.
  if (name === 'PayphoneError' && message) return message;
  return String(code ?? type ?? name ?? 'unknown');
};
