import type { Handler } from "@netlify/functions";
import { getFirebaseAdmin } from '../lib/firebase-admin';
import { getBearerToken, verifyIdToken } from '../lib/verify-id-token';
import { calculateOrderTotalCents, type OrderCoupon } from '../../utils/cart';

const ORDER_ALLOWED_STATUSES = ['APPROVED', 'ACTIVE'];
const PAYMENT_METHODS = ['transfer', 'cash'];
const MAX_ITEMS = 50;
const MAX_QUANTITY = 1000;
const MAX_CUSTOMIZATION_BYTES = 10 * 1024;
const MAX_DOC_ID_LENGTH = 256;
const MAX_COUPON_CODE_LENGTH = 64;
const CUSTOMER_FIELD_LIMITS = { name: 200, email: 254, address: 300, city: 100, postalCode: 32 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CouponRejection = 'invalid' | 'expired';

const jsonResponse = (statusCode: number, body: object) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const invalidInput = (error: string) => jsonResponse(422, { error });
const invalidCoupon = (reason: CouponRejection | 'min-purchase') => jsonResponse(422, { error: "Coupon not applicable.", reason });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Una "/" apuntaría a otra ruta de Firestore; "." y ".." y __x__ son ids reservados.
const isValidDocId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim() !== '' &&
  value.length <= MAX_DOC_ID_LENGTH &&
  !value.includes('/') &&
  value !== '.' &&
  value !== '..' &&
  !/^__.*__$/.test(value);

const isValidPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const parseCustomer = (value: unknown) => {
  if (!isPlainObject(value)) return null;
  const customer = {} as Record<keyof typeof CUSTOMER_FIELD_LIMITS, string>;
  for (const [field, maxLength] of Object.entries(CUSTOMER_FIELD_LIMITS) as [keyof typeof CUSTOMER_FIELD_LIMITS, number][]) {
    const fieldValue = value[field];
    if (typeof fieldValue !== 'string') return null;
    const trimmed = fieldValue.trim();
    if (!trimmed || trimmed.length > maxLength) return null;
    customer[field] = trimmed;
  }
  return EMAIL_PATTERN.test(customer.email) ? customer : null;
};

const isValidCustomization = (value: unknown) =>
  value === undefined ||
  (isPlainObject(value) && Buffer.byteLength(JSON.stringify(value)) <= MAX_CUSTOMIZATION_BYTES);

const parseItems = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) return null;
  const items: { productId: string; quantity: number; customization: object }[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return null;
    const { productId, quantity, customization } = item;
    if (!isValidDocId(productId)) return null;
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_QUANTITY) return null;
    if (!isValidCustomization(customization)) return null;
    // El Admin SDK no admite `undefined`; el carrito manda {} cuando no hay personalización.
    items.push({ productId, quantity: quantity as number, customization: (customization as object | undefined) ?? {} });
  }
  return items;
};

/** Motivo por el que no se puede usar un cupón guardado; undefined si se puede. */
const getCouponRejection = (coupon: FirebaseFirestore.DocumentData): CouponRejection | undefined => {
  const { isActive, discountType, discountValue, minPurchase, validUntil } = coupon;
  if (!isActive) return 'invalid';
  // Un cupón mal guardado no debe descontar nada por accidente.
  if ((discountType !== 'percentage' && discountType !== 'fixed') || !isValidPrice(discountValue)) return 'invalid';
  if (minPurchase !== undefined && minPurchase !== null && !isValidPrice(minPurchase)) return 'invalid';
  if (validUntil) {
    // En el Admin SDK, `validUntil` es un Timestamp, igual que en mapDocToCoupon.
    if (typeof validUntil.toDate !== 'function') return 'invalid';
    if ((validUntil.toDate() as Date) < new Date()) return 'expired';
  }
  return undefined;
};

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

  // Solo se leen estos campos: cualquier precio, total, descuento o userId del cuerpo se ignora.
  const { companyId, shippingMethodId, couponCode, paymentMethod } = body;
  if (!isValidDocId(companyId)) return invalidInput("Invalid 'companyId'.");
  if (!isValidDocId(shippingMethodId)) return invalidInput("Invalid 'shippingMethodId'.");
  if (typeof paymentMethod !== 'string' || !PAYMENT_METHODS.includes(paymentMethod)) {
    return invalidInput("'paymentMethod' must be 'transfer' or 'cash'.");
  }

  const customer = parseCustomer(body.customer);
  if (!customer) return invalidInput("Invalid 'customer'.");

  const items = parseItems(body.items);
  if (!items) return invalidInput("Invalid 'items'.");

  const hasCoupon = couponCode !== undefined && couponCode !== null && couponCode !== '';
  if (hasCoupon && (typeof couponCode !== 'string' || couponCode.length > MAX_COUPON_CODE_LENGTH)) {
    return invalidCoupon('invalid');
  }

  try {
    const companySnapshot = await db.collection('companies').doc(companyId).get();
    if (!companySnapshot.exists) {
      return jsonResponse(404, { error: "Company not found." });
    }
    if (!ORDER_ALLOWED_STATUSES.includes(companySnapshot.data()?.status)) {
      return jsonResponse(403, { error: "This company cannot receive orders." });
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const productSnapshots = await db.getAll(...productIds.map((id) => db.collection('products').doc(id)));
    const products = new Map(productSnapshots.map((snapshot) => [snapshot.id, snapshot.exists ? snapshot.data() : undefined]));
    const orderItems = [];
    for (const { productId, quantity, customization } of items) {
      const product = products.get(productId);
      if (product?.companyId !== companyId || !isValidPrice(product.price) || typeof product.name !== 'string') {
        return invalidInput("A product is not available in this company.");
      }
      orderItems.push({ productId, productName: product.name, quantity, price: product.price, customization });
    }

    const shippingSnapshot = await db.collection('shippingMethods').doc(shippingMethodId).get();
    const shipping = shippingSnapshot.exists ? shippingSnapshot.data() : undefined;
    if (shipping?.companyId !== companyId || !isValidPrice(shipping.price) || typeof shipping.name !== 'string') {
      return invalidInput("The shipping method is not available in this company.");
    }

    let coupon: OrderCoupon | null = null;
    let appliedCode = '';
    if (hasCoupon) {
      const couponSnapshot = await db.collection('coupons')
        .where('companyId', '==', companyId)
        .where('code', '==', (couponCode as string).toUpperCase())
        .limit(1)
        .get();
      if (couponSnapshot.empty) return invalidCoupon('invalid');

      const couponData = couponSnapshot.docs[0].data();
      const rejection = getCouponRejection(couponData);
      if (rejection) return invalidCoupon(rejection);

      coupon = {
        discountType: couponData.discountType,
        discountValue: couponData.discountValue,
        minPurchase: couponData.minPurchase ?? undefined,
      };
      appliedCode = couponData.code;
    }

    const amounts = calculateOrderTotalCents({
      lines: orderItems.map(({ price, quantity }) => ({ price, quantity })),
      coupon,
      shippingCost: shipping.price,
    });
    if (!amounts.minPurchaseMet) return invalidCoupon('min-purchase');

    const total = amounts.total / 100;
    const orderRef = await db.collection('orders').add({
      userId: uid,
      companyId,
      customer,
      items: orderItems,
      total,
      shippingMethod: shipping.name,
      shippingCost: amounts.shipping / 100,
      payment: { method: paymentMethod, last4: '' },
      couponCode: appliedCode,
      discount: amounts.discount / 100,
      date: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'Pendiente de pago',
    });

    return jsonResponse(201, { orderId: orderRef.id, total });
  } catch (error) {
    // Solo el código: el mensaje podría incluir datos del pedido o del cliente.
    console.error('Could not create the order:', (error as { code?: string | number }).code ?? 'unknown');
    return jsonResponse(500, { error: "Could not create the order." });
  }
};
