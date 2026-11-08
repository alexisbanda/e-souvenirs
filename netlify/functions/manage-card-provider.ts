/**
 * Consulta, activa o desactiva el pago con tarjeta de una tienda. Solo para el superadmin.
 * Hace lo mismo que scripts/set-card-provider.ts, pero desde el panel.
 *
 *   GET  ?companyId=<id>
 *   POST { companyId, provider: 'payphone', token, storeId, taxRate? }
 *   POST { companyId, provider: 'stripe' }
 *   POST { companyId, disable: true }
 *
 * Nunca devuelve ni loguea el token de Payphone ni el cuerpo de la petición.
 */
import type { Handler } from "@netlify/functions";
import { getFirebaseAdmin } from '../lib/firebase-admin';
import { getBearerToken, verifyIdToken } from '../lib/verify-id-token';
import { isPlainObject, jsonResponse } from '../lib/order-pricing';
import { getCardCredentials, parseCardCredentials, PAYMENT_CREDENTIALS_COLLECTION, type CardCredentials } from '../lib/payments/credentials';
import { isSuperadmin } from '../lib/superadmin';
import { resolvePaymentMethods } from '../../utils/paymentMethods';

const isValidCompanyId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && !value.includes('/');

/** Lo que se puede mostrar de las credenciales: todo salvo el token. */
const publicStatus = (credentials: CardCredentials | null) => {
  if (!credentials) return { provider: null };
  if (credentials.provider === 'stripe') return { provider: 'stripe' };
  const { storeId, taxRate } = credentials.payphone;
  return { provider: 'payphone', storeId, ...(taxRate === undefined ? {} : { taxRate }) };
};

const errorCode = (error: unknown) => (error as { code?: string | number }).code ?? 'unknown';

/** Interpreta el cuerpo del POST: las credenciales a guardar, null para desactivar, o un error. */
const parseRequest = (body: Record<string, unknown>): { ok: true; companyId: string; credentials: CardCredentials | null } | { ok: false; error: string } => {
  const { companyId, provider, disable } = body;
  if (!isValidCompanyId(companyId)) return { ok: false, error: "'companyId' is required." };
  const wantsDisable = disable === true;
  if (disable !== undefined && disable !== true) return { ok: false, error: "'disable' must be true." };
  if (wantsDisable === (provider !== undefined)) return { ok: false, error: "Send either 'provider' or 'disable'." };
  if (wantsDisable) return { ok: true, companyId, credentials: null };

  if (provider === 'stripe') return { ok: true, companyId, credentials: { provider: 'stripe' } };
  if (provider !== 'payphone') return { ok: false, error: "'provider' must be 'payphone' or 'stripe'." };

  const { token, storeId, taxRate } = body;
  // parseCardCredentials toma null como «sin IVA»; aquí solo se acepta omitirlo.
  if (taxRate === null) return { ok: false, error: "'taxRate' must be a number in [0, 1)." };
  const credentials = parseCardCredentials({
    provider: 'payphone',
    payphone: { token, storeId, ...(taxRate === undefined ? {} : { taxRate }) },
  });
  if (!credentials) {
    return { ok: false, error: "Payphone needs 'token' and 'storeId'; 'taxRate' must be a number in [0, 1)." };
  }
  return { ok: true, companyId, credentials };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  const idToken = getBearerToken(event.headers);
  if (!idToken) {
    return jsonResponse(401, { error: "Authentication required." });
  }

  let firebase: ReturnType<typeof getFirebaseAdmin>;
  let db: FirebaseFirestore.Firestore;
  try {
    firebase = getFirebaseAdmin();
    db = firebase.firestore();
  } catch (error) {
    console.error('Could not initialize Firebase Admin SDK:', (error as Error).message);
    return jsonResponse(500, { error: "Internal server configuration error." });
  }

  let uid: string | null;
  try {
    uid = await verifyIdToken(idToken, firebase.auth());
  } catch (error) {
    console.error('Could not verify the Firebase ID token:', errorCode(error));
    return jsonResponse(503, { error: "Could not verify the session." });
  }
  if (!uid) {
    return jsonResponse(401, { error: "Authentication required." });
  }

  try {
    if (!(await isSuperadmin(db, uid))) {
      return jsonResponse(403, { error: "Only the superadmin can manage card payments." });
    }
  } catch (error) {
    console.error('Could not read the user role:', errorCode(error));
    return jsonResponse(500, { error: "Could not check the user role." });
  }

  if (event.httpMethod === 'GET') {
    const companyId = event.queryStringParameters?.companyId;
    if (!isValidCompanyId(companyId)) {
      return jsonResponse(422, { error: "'companyId' is required." });
    }
    try {
      return jsonResponse(200, publicStatus(await getCardCredentials(db, companyId)));
    } catch (error) {
      console.error(`Could not read the card provider of company ${companyId}:`, errorCode(error));
      return jsonResponse(500, { error: "Could not read the card provider." });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    // El error de JSON.parse puede citar parte del cuerpo (y del token): no se loguea.
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }
  if (!isPlainObject(body)) {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const request = parseRequest(body);
  if (!request.ok) {
    return jsonResponse(422, { error: request.error, reason: 'validation' });
  }
  const { companyId, credentials } = request;

  try {
    const companyRef = db.collection('companies').doc(companyId);
    const company = await companyRef.get();
    if (!company.exists) {
      return jsonResponse(404, { error: `Company ${companyId} not found.` });
    }

    if (!credentials) {
      const { transfer, cash } = resolvePaymentMethods(company.data()?.paymentMethods);
      if (!transfer && !cash) {
        return jsonResponse(422, {
          error: "The company needs at least one payment method: enable transfer or cash before disabling the card.",
          reason: 'last-payment-method',
        });
      }
    }

    const credentialsRef = db.collection(PAYMENT_CREDENTIALS_COLLECTION).doc(companyId);
    const { FieldValue } = firebase.firestore;
    const batch = db.batch();
    if (credentials) {
      batch.set(credentialsRef, { ...credentials, updatedAt: FieldValue.serverTimestamp() });
      batch.update(companyRef, { cardProvider: credentials.provider });
    } else {
      batch.delete(credentialsRef);
      batch.update(companyRef, { cardProvider: FieldValue.delete() });
    }
    await batch.commit();

    console.info(`Card provider of company ${companyId} set to ${credentials?.provider ?? 'none'} by ${uid}.`);
    return jsonResponse(200, publicStatus(credentials));
  } catch (error) {
    // Solo el código: el mensaje podría incluir datos de la petición, token incluido.
    console.error(`Could not update the card provider of company ${companyId}:`, errorCode(error));
    return jsonResponse(500, { error: "Could not update the card provider." });
  }
};
