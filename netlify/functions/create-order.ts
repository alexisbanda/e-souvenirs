import type { Handler } from "@netlify/functions";
import { getFirebaseAdmin } from '../lib/firebase-admin';
import { getBearerToken, verifyIdToken } from '../lib/verify-id-token';
import { failureResponse, isPlainObject, jsonResponse, orderFields, priceOrder } from '../lib/order-pricing';

const PAYMENT_METHODS = ['transfer', 'cash'];

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }
  if (!isPlainObject(body)) {
    return jsonResponse(400, { error: "Invalid JSON payload." });
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
    // No es un problema de la sesión: pedir que la inicie de nuevo no lo arreglaría.
    console.error('Could not verify the Firebase ID token:', (error as { code?: string }).code ?? (error as Error).message);
    return jsonResponse(503, { error: "Could not verify the session." });
  }
  if (!uid) {
    return jsonResponse(401, { error: "Authentication required." });
  }

  const { paymentMethod } = body;
  if (typeof paymentMethod !== 'string' || !PAYMENT_METHODS.includes(paymentMethod)) {
    return jsonResponse(422, { error: "'paymentMethod' must be 'transfer' or 'cash'." });
  }

  try {
    const result = await priceOrder(db, body);
    if (!result.ok) return failureResponse(result);

    const fields = orderFields(result.priced);
    const orderRef = await db.collection('orders').add({
      userId: uid,
      ...fields,
      payment: { method: paymentMethod, last4: '' },
      date: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'Pendiente de pago',
    });

    return jsonResponse(201, { orderId: orderRef.id, total: fields.total });
  } catch (error) {
    // Solo el código: el mensaje podría incluir datos del pedido o del cliente.
    console.error('Could not create the order:', (error as { code?: string | number }).code ?? 'unknown');
    return jsonResponse(500, { error: "Could not create the order." });
  }
};
