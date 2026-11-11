import { calculateOrderTotalCents, type OrderCoupon } from '../../utils/cart';
import { resolvePaymentMethods, type PaymentMethodsSetting } from '../../utils/paymentMethods';

/**
 * Valida un pedido y calcula su importe con los datos guardados en Firestore.
 * Del cuerpo solo se leen ids, cantidades, personalización, cupón y cliente:
 * cualquier precio, total, descuento o userId que traiga se ignora.
 */

const ORDER_ALLOWED_STATUSES = ['APPROVED', 'ACTIVE'];
const MAX_ITEMS = 50;
const MAX_QUANTITY = 1000;
const MAX_CUSTOMIZATION_BYTES = 10 * 1024;
const MAX_DOC_ID_LENGTH = 256;
const MAX_COUPON_CODE_LENGTH = 64;
const CUSTOMER_FIELD_LIMITS = { name: 200, email: 254, address: 300, city: 100 };
const POSTAL_CODE_MAX_LENGTH = 32;
const PHONE_MIN_LENGTH = 7;
const PHONE_MAX_LENGTH = 20;
const PHONE_MIN_DIGITS = 7;
const PHONE_PATTERN = /^[0-9 +\-()]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CouponRejection = 'invalid' | 'expired';

export type Customer = Record<keyof typeof CUSTOMER_FIELD_LIMITS, string> & { phone: string; postalCode?: string };

export interface PricedItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  customization: object;
}

export interface PricedOrder {
  companyId: string;
  company: { name: string; slug: string };
  customer: Customer;
  items: PricedItem[];
  shippingMethod: string;
  couponCode: string;
  /** Importes en centavos. */
  amounts: { subtotal: number; discount: number; shipping: number; total: number };
  /** Transferencia y efectivo activos en la tienda. No se guarda en la orden. */
  paymentMethods: PaymentMethodsSetting;
}

export type PriceOrderFailure = { ok: false; status: number; error: string; reason?: string };
export type PriceOrderResult = { ok: true; priced: PricedOrder } | PriceOrderFailure;

export const jsonResponse = (statusCode: number, body: object) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Respuesta HTTP de un rechazo de priceOrder. */
export const failureResponse = ({ status, error, reason }: PriceOrderFailure) =>
  jsonResponse(status, reason ? { error, reason } : { error });

const fail = (status: number, error: string, reason?: string): PriceOrderFailure => ({ ok: false, status, error, reason });
const invalidInput = (error: string) => fail(422, error);
const invalidCoupon = (reason: CouponRejection | 'min-purchase') => fail(422, 'Coupon not applicable.', reason);

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Una "/" apuntaría a otra ruta de Firestore; "." y ".." y __x__ son ids reservados.
export const isValidDocId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim() !== '' &&
  value.length <= MAX_DOC_ID_LENGTH &&
  !value.includes('/') &&
  value !== '.' &&
  value !== '..' &&
  !/^__.*__$/.test(value);

const isValidPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const parsePhone = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const phone = value.trim();
  if (phone.length < PHONE_MIN_LENGTH || phone.length > PHONE_MAX_LENGTH) return null;
  if (!PHONE_PATTERN.test(phone)) return null;
  return (phone.match(/[0-9]/g) ?? []).length >= PHONE_MIN_DIGITS ? phone : null;
};

const parseCustomer = (value: unknown): Customer | null => {
  if (!isPlainObject(value)) return null;
  const customer = {} as Customer;
  for (const [field, maxLength] of Object.entries(CUSTOMER_FIELD_LIMITS) as [keyof typeof CUSTOMER_FIELD_LIMITS, number][]) {
    const fieldValue = value[field];
    if (typeof fieldValue !== 'string') return null;
    const trimmed = fieldValue.trim();
    if (!trimmed || trimmed.length > maxLength) return null;
    customer[field] = trimmed;
  }
  if (!EMAIL_PATTERN.test(customer.email)) return null;

  const phone = parsePhone(value.phone);
  if (!phone) return null;
  customer.phone = phone;

  // Código postal opcional: si falta o viene vacío se omite la clave (Firestore no admite undefined).
  const postalCode = typeof value.postalCode === 'string' ? value.postalCode.trim() : '';
  if (postalCode.length > POSTAL_CODE_MAX_LENGTH) return null;
  if (postalCode) customer.postalCode = postalCode;
  return customer;
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

/**
 * Valida la entrada y calcula el pedido. Los errores de Firestore se propagan:
 * quien llama decide cómo responder.
 */
export const priceOrder = async (db: FirebaseFirestore.Firestore, body: Record<string, unknown>): Promise<PriceOrderResult> => {
  const { companyId, shippingMethodId, couponCode } = body;
  if (!isValidDocId(companyId)) return invalidInput("Invalid 'companyId'.");
  if (!isValidDocId(shippingMethodId)) return invalidInput("Invalid 'shippingMethodId'.");

  const customer = parseCustomer(body.customer);
  if (!customer) return invalidInput("Invalid 'customer'.");

  const items = parseItems(body.items);
  if (!items) return invalidInput("Invalid 'items'.");

  const hasCoupon = couponCode !== undefined && couponCode !== null && couponCode !== '';
  if (hasCoupon && (typeof couponCode !== 'string' || couponCode.length > MAX_COUPON_CODE_LENGTH)) {
    return invalidCoupon('invalid');
  }

  const companySnapshot = await db.collection('companies').doc(companyId).get();
  if (!companySnapshot.exists) {
    return fail(404, 'Company not found.');
  }
  const company = companySnapshot.data();
  if (!ORDER_ALLOWED_STATUSES.includes(company?.status)) {
    return fail(403, 'This company cannot receive orders.');
  }

  const productIds = [...new Set(items.map((item) => item.productId))];
  const productSnapshots = await db.getAll(...productIds.map((id) => db.collection('products').doc(id)));
  const products = new Map(productSnapshots.map((snapshot) => [snapshot.id, snapshot.exists ? snapshot.data() : undefined]));
  const orderItems: PricedItem[] = [];
  for (const { productId, quantity, customization } of items) {
    const product = products.get(productId);
    if (product?.companyId !== companyId || !isValidPrice(product.price) || typeof product.name !== 'string') {
      return invalidInput('A product is not available in this company.');
    }
    orderItems.push({ productId, productName: product.name, quantity, price: product.price, customization });
  }

  const shippingSnapshot = await db.collection('shippingMethods').doc(shippingMethodId).get();
  const shipping = shippingSnapshot.exists ? shippingSnapshot.data() : undefined;
  if (shipping?.companyId !== companyId || !isValidPrice(shipping.price) || typeof shipping.name !== 'string') {
    return invalidInput('The shipping method is not available in this company.');
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

  return {
    ok: true,
    priced: {
      companyId,
      company: {
        name: typeof company?.name === 'string' ? company.name : '',
        slug: typeof company?.slug === 'string' ? company.slug : '',
      },
      customer,
      items: orderItems,
      shippingMethod: shipping.name,
      couponCode: appliedCode,
      amounts: { subtotal: amounts.subtotal, discount: amounts.discount, shipping: amounts.shipping, total: amounts.total },
      paymentMethods: resolvePaymentMethods(company?.paymentMethods),
    },
  };
};

/** Campos del pedido que se guardan en `orders`, con los importes en dólares. */
export const orderFields = (priced: Pick<PricedOrder, 'companyId' | 'customer' | 'items' | 'shippingMethod' | 'couponCode' | 'amounts'>) => ({
  companyId: priced.companyId,
  customer: priced.customer,
  items: priced.items,
  total: priced.amounts.total / 100,
  shippingMethod: priced.shippingMethod,
  shippingCost: priced.amounts.shipping / 100,
  couponCode: priced.couponCode,
  discount: priced.amounts.discount / 100,
});
