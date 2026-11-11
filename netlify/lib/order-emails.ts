import { formatOrderNumber } from '../../utils/orderNumber';
import { customizationLines } from '../../utils/orderCustomization';
import type { Order } from '../../types';

/**
 * Correos de un pedido nuevo (#67): la confirmación al comprador y el aviso de venta al vendedor,
 * enviados con la API REST de Resend.
 *
 * - Una sola vez por pedido: antes de enviar se reserva en una transacción la marca
 *   `notifications.buyerEmailSentAt` / `sellerEmailSentAt`; si ya existe, no se envía. Si el
 *   envío falla, se libera la marca para que una confirmación posterior lo reintente.
 * - Nunca lanza y nunca registra datos personales: solo el id del pedido y el código del error.
 */

export const RESEND_API_URL = 'https://api.resend.com/emails';
export const EMAIL_TIMEOUT_MS = 5000;

export type EmailFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number }>;

export interface EmailLogger {
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface OrderEmailDeps {
  fetch?: EmailFetch;
  env?: Record<string, string | undefined>;
  logger?: EmailLogger;
  /** Valor de las marcas `notifications.*SentAt`. Las funciones pasan el serverTimestamp de Firestore. */
  serverTimestamp?: () => unknown;
  timeoutMs?: number;
}

type Kind = 'buyer' | 'seller';
type Language = 'es' | 'en';

const MARKS = { buyer: 'buyerEmailSentAt', seller: 'sellerEmailSentAt' } as const;

export interface OrderEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

type OrderData = Partial<Omit<Order, 'id'>>;
type OrderItem = Order['items'][number];

interface CompanyData {
  name?: string;
  adminUid?: string;
  contact?: { email?: string };
  settings?: { defaultLanguage?: string; transferText?: string; cashText?: string };
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const amount = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const money = (value: number) => `$${value.toFixed(2)}`;

/** Una sola dirección, sin espacios ni separadores: Resend no debe recibir varios destinatarios. */
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
const validEmail = (value: unknown): string | null => {
  const email = text(value);
  return EMAIL.test(email) ? email : null;
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Para logs: tipo o código del error, nunca el mensaje (podría citar datos del pedido). */
const errorCode = (error: unknown): string => {
  const { name, code } = (error ?? {}) as { name?: string; code?: string | number };
  return String(code ?? name ?? 'unknown');
};

// ---------- Plantilla: bloques que se pintan en HTML (escapado) y en texto plano ----------

type Row = { label: string; value: string; strong?: boolean };
type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'rows'; rows: Row[] }
  | { kind: 'items'; items: { title: string; details: string[]; amount: string }[] }
  | { kind: 'link'; label: string; url: string };

const multiline = (value: string) => escapeHtml(value).replace(/\r?\n/g, '<br>');
const CELL = 'padding:6px 0;border-bottom:1px solid #eeeeee;vertical-align:top';

const blockHtml = (block: Block): string => {
  switch (block.kind) {
    case 'heading':
      return `<h2 style="font-size:18px;margin:24px 0 8px">${escapeHtml(block.text)}</h2>`;
    case 'paragraph':
      return `<p style="margin:8px 0;line-height:1.5">${multiline(block.text)}</p>`;
    case 'rows':
      return `<table role="presentation" style="width:100%;border-collapse:collapse">${block.rows
        .map(({ label, value, strong }) => {
          const cell = (content: string, align: string) =>
            `<td style="${CELL};text-align:${align}">${strong ? `<strong>${content}</strong>` : content}</td>`;
          return `<tr>${cell(escapeHtml(label), 'left')}${cell(multiline(value), 'right')}</tr>`;
        })
        .join('')}</table>`;
    case 'items':
      return `<table role="presentation" style="width:100%;border-collapse:collapse">${block.items
        .map(
          ({ title, details, amount: price }) =>
            `<tr><td style="${CELL}"><strong>${escapeHtml(title)}</strong>${details
              .map((detail) => `<br><span style="color:#666666;font-size:13px">${escapeHtml(detail)}</span>`)
              .join('')}</td><td style="${CELL};text-align:right">${escapeHtml(price)}</td></tr>`,
        )
        .join('')}</table>`;
    case 'link':
      return `<p style="margin:24px 0"><a href="${escapeHtml(block.url)}" style="color:#1a56db">${escapeHtml(block.label)}</a></p>`;
  }
};

const blockText = (block: Block): string => {
  switch (block.kind) {
    case 'heading':
      return block.text;
    case 'paragraph':
      return block.text;
    case 'rows':
      return block.rows.map(({ label, value }) => `${label}: ${value}`).join('\n');
    case 'items':
      return block.items
        .map(({ title, details, amount: price }) => [`- ${title}: ${price}`, ...details.map((detail) => `    ${detail}`)].join('\n'))
        .join('\n');
    case 'link':
      return `${block.label}: ${block.url}`;
  }
};

const render = (language: Language, blocks: Block[]) => ({
  html:
    `<!doctype html><html lang="${language}"><head><meta charset="utf-8"></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;color:#222222;max-width:600px;margin:0 auto;padding:16px">` +
    `${blocks.map(blockHtml).join('')}</body></html>`,
  text: `${blocks.map(blockText).join('\n\n')}\n`,
});

/** El asunto es texto plano en una línea. */
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

// ---------- Textos (el del vendedor, siempre en español) ----------

const BUYER_TEXT = {
  es: {
    subject: (number: string, store: string) => `Tu pedido ${number} en ${store}`,
    greeting: (name: string) => (name ? `Hola ${name},` : 'Hola,'),
    intro: (number: string, store: string) => `Recibimos tu pedido ${number} en ${store}. Este es el resumen:`,
    each: (price: string) => `${price} c/u`,
    shipping: 'Envío',
    discount: 'Descuento',
    total: 'Total',
    paymentMethod: 'Método de pago',
    methods: { transfer: 'Transferencia bancaria', cash: 'Efectivo', card: 'Tarjeta: pago aprobado' } as Record<string, string>,
    transferTitle: 'Datos para transferencia bancaria',
    transferDefault: 'Realiza la transferencia a la siguiente cuenta y confirma tu pago.',
    receiptHint: (number: string) => `Envía el comprobante indicando tu número de pedido: ${number}.`,
    cashTitle: 'Pago en efectivo',
    cashDefault: 'Podrás pagar en efectivo al recibir tu pedido o en el punto de entrega acordado.',
    replyHint: 'Si tienes alguna pregunta, responde a este correo.',
    defaultStore: 'nuestra tienda',
  },
  en: {
    subject: (number: string, store: string) => `Your order ${number} at ${store}`,
    greeting: (name: string) => (name ? `Hi ${name},` : 'Hi,'),
    intro: (number: string, store: string) => `We received your order ${number} at ${store}. Here is the summary:`,
    each: (price: string) => `${price} each`,
    shipping: 'Shipping',
    discount: 'Discount',
    total: 'Total',
    paymentMethod: 'Payment method',
    methods: { transfer: 'Bank transfer', cash: 'Cash', card: 'Card: payment approved' } as Record<string, string>,
    transferTitle: 'Bank transfer details',
    transferDefault: 'Please make the transfer to the following account and confirm your payment.',
    receiptHint: (number: string) => `Send your receipt stating your order number: ${number}.`,
    cashTitle: 'Cash payment',
    cashDefault: 'You can pay in cash upon receiving your order or at the agreed delivery point.',
    replyHint: 'If you have any questions, reply to this email.',
    defaultStore: 'our store',
  },
} satisfies Record<Language, unknown>;

const SELLER_METHODS: Record<string, string> = {
  transfer: 'Transferencia bancaria (pendiente de pago)',
  cash: 'Efectivo (pendiente de pago)',
  card: 'Tarjeta (pago aprobado)',
};

const items = (order: OrderData): OrderItem[] => (Array.isArray(order.items) ? order.items : []);

const itemTitle = (item: OrderItem) => `${text(item.productName)} × ${amount(item.quantity)}`;
const itemTotal = (item: OrderItem) => money(amount(item.price) * amount(item.quantity));

/** Envío, descuento (si hay) y total, como en el resumen del checkout. */
const totalRows = (order: OrderData, labels: { shipping: string; discount: string; total: string }): Row[] => {
  const shippingMethod = text(order.shippingMethod);
  const discount = amount(order.discount);
  const couponCode = text(order.couponCode);
  return [
    { label: shippingMethod ? `${labels.shipping} (${shippingMethod})` : labels.shipping, value: money(amount(order.shippingCost)) },
    ...(discount > 0 ? [{ label: couponCode ? `${labels.discount} (${couponCode})` : labels.discount, value: `-${money(discount)}` }] : []),
    { label: labels.total, value: money(amount(order.total)), strong: true },
  ];
};

const languageOf = (company: CompanyData): Language => (company.settings?.defaultLanguage === 'en' ? 'en' : 'es');

export const buildBuyerEmail = (orderId: string, order: OrderData, company: CompanyData, to: string): OrderEmail => {
  const language = languageOf(company);
  const t = BUYER_TEXT[language];
  const number = formatOrderNumber(orderId);
  const store = text(company.name) || t.defaultStore;
  const method = text(order.payment?.method);
  const replyTo = validEmail(company.contact?.email) ?? undefined;

  const payment: Block[] = [{ kind: 'rows', rows: [{ label: t.paymentMethod, value: t.methods[method] ?? method }] }];
  if (method === 'transfer') {
    payment.push(
      { kind: 'heading', text: t.transferTitle },
      { kind: 'paragraph', text: text(company.settings?.transferText) || t.transferDefault },
      { kind: 'paragraph', text: t.receiptHint(number) },
    );
  } else if (method === 'cash') {
    payment.push({ kind: 'heading', text: t.cashTitle }, { kind: 'paragraph', text: text(company.settings?.cashText) || t.cashDefault });
  }

  const blocks: Block[] = [
    { kind: 'paragraph', text: t.greeting(text(order.customer?.name)) },
    { kind: 'paragraph', text: t.intro(number, store) },
    {
      kind: 'items',
      items: items(order).map((item) => ({ title: itemTitle(item), details: [t.each(money(amount(item.price)))], amount: itemTotal(item) })),
    },
    { kind: 'rows', rows: totalRows(order, t) },
    ...payment,
    ...(replyTo ? [{ kind: 'paragraph', text: t.replyHint } as const] : []),
  ];

  return { to, subject: oneLine(t.subject(number, store)), ...render(language, blocks), ...(replyTo ? { replyTo } : {}) };
};

export const buildSellerEmail = (
  orderId: string,
  order: OrderData,
  company: CompanyData,
  to: string,
  siteUrl: string | null,
): OrderEmail => {
  const number = formatOrderNumber(orderId);
  const method = text(order.payment?.method);
  const store = text(company.name);

  const blocks: Block[] = [
    { kind: 'heading', text: store ? `Nueva venta en ${store}` : 'Nueva venta' },
    { kind: 'paragraph', text: `Pedido ${number}` },
    { kind: 'heading', text: 'Comprador' },
    {
      kind: 'rows',
      rows: [
        { label: 'Nombre', value: text(order.customer?.name) || '—' },
        { label: 'Correo', value: text(order.customer?.email) || '—' },
        { label: 'Teléfono', value: text(order.customer?.phone) || 'No indicado' },
      ],
    },
    { kind: 'heading', text: 'Artículos' },
    {
      kind: 'items',
      items: items(order).map((item) => ({
        title: itemTitle(item),
        details: customizationLines({ customization: item.customization, customizationLabels: item.customizationLabels }),
        amount: itemTotal(item),
      })),
    },
    { kind: 'rows', rows: totalRows(order, { shipping: 'Envío', discount: 'Descuento', total: 'Total' }) },
    { kind: 'rows', rows: [{ label: 'Método de pago', value: SELLER_METHODS[method] ?? method }] },
    ...(siteUrl
      ? [{ kind: 'link', label: 'Ver el pedido en el panel', url: `${siteUrl}/admin/orders/${encodeURIComponent(orderId)}` } as const]
      : []),
  ];

  return { to, subject: oneLine(`Nueva venta ${number} · ${money(amount(order.total))}`), ...render('es', blocks) };
};

// ---------- Envío ----------

/** Devuelve null si Resend aceptó el correo, o el código del fallo (status HTTP, nombre del error o 'timeout'). */
const post = async (
  fetchImpl: EmailFetch,
  apiKey: string,
  from: string,
  email: OrderEmail,
  idempotencyKey: string,
  timeoutMs: number,
): Promise<string | null> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // La carrera garantiza el límite aunque la implementación de fetch ignore la señal.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error('Resend timeout'), { code: 'timeout' }));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetchImpl(RESEND_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
        signal: controller.signal,
      }),
      timeout,
    ]);
    return response.ok ? null : `HTTP ${response.status}`;
  } catch (error) {
    return controller.signal.aborted ? 'timeout' : errorCode(error);
  } finally {
    clearTimeout(timer);
  }
};

type Notifications = Partial<Record<(typeof MARKS)[Kind], unknown>>;

const notificationsOf = (data: Record<string, unknown> | undefined): Notifications => {
  const value = data?.notifications;
  return value && typeof value === 'object' ? { ...(value as Notifications) } : {};
};

/** Reserva en una transacción las marcas libres de `kinds` y devuelve los correos reservados. */
const reserve = (db: FirebaseFirestore.Firestore, orderRef: FirebaseFirestore.DocumentReference, kinds: Kind[], now: () => unknown) =>
  db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) return [];
    const notifications = notificationsOf(snapshot.data());
    const free = kinds.filter((kind) => !notifications[MARKS[kind]]);
    if (free.length === 0) return [];
    for (const kind of free) notifications[MARKS[kind]] = now();
    transaction.update(orderRef, { notifications });
    return free;
  });

/** Borra las marcas de los correos que no se pudieron enviar. */
const release = (db: FirebaseFirestore.Firestore, orderRef: FirebaseFirestore.DocumentReference, kinds: Kind[]) =>
  db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) return;
    const notifications = notificationsOf(snapshot.data());
    for (const kind of kinds) delete notifications[MARKS[kind]];
    transaction.update(orderRef, { notifications });
  });

/** Correo de contacto de la tienda o, si falta, el del companyadmin (users/<adminUid>). */
const sellerRecipient = async (db: FirebaseFirestore.Firestore, company: CompanyData): Promise<string | null> => {
  const contact = validEmail(company.contact?.email);
  if (contact) return contact;
  const adminUid = text(company.adminUid);
  if (!adminUid || adminUid.includes('/')) return null;
  const snapshot = await db.collection('users').doc(adminUid).get();
  return snapshot.exists ? validEmail(snapshot.data()?.email) : null;
};

export const sendOrderEmails = async (db: FirebaseFirestore.Firestore, orderId: string, deps: OrderEmailDeps = {}): Promise<void> => {
  const logger = deps.logger ?? console;
  try {
    const env = deps.env ?? process.env;
    const apiKey = text(env.RESEND_API_KEY);
    const from = text(env.RESEND_FROM);
    if (!apiKey || !from) {
      logger.warn(`Order emails for ${orderId} not sent: ${apiKey ? 'RESEND_FROM' : 'RESEND_API_KEY'} is not set.`);
      return;
    }
    const fetchImpl = deps.fetch ?? (globalThis.fetch as unknown as EmailFetch);
    const now = deps.serverTimestamp ?? (() => new Date());
    const timeoutMs = deps.timeoutMs ?? EMAIL_TIMEOUT_MS;
    const siteUrl = text(env.URL).replace(/\/+$/, '') || null;

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();
    const order = (orderSnapshot.exists ? orderSnapshot.data() : undefined) as OrderData | undefined;
    if (!order) {
      logger.error(`Order emails for ${orderId} not sent: order not found.`);
      return;
    }
    const companyId = text(order.companyId);
    const companySnapshot = companyId && !companyId.includes('/') ? await db.collection('companies').doc(companyId).get() : null;
    const company = (companySnapshot?.exists ? companySnapshot.data() : undefined) as CompanyData | undefined;
    if (!company) {
      logger.error(`Order emails for ${orderId} not sent: company not found.`);
      return;
    }

    const emails: Partial<Record<Kind, OrderEmail>> = {};
    const buyerTo = validEmail(order.customer?.email);
    if (buyerTo) emails.buyer = buildBuyerEmail(orderId, order, company, buyerTo);
    else logger.warn(`Buyer email for order ${orderId} not sent: no recipient.`);
    const sellerTo = await sellerRecipient(db, company);
    if (sellerTo) emails.seller = buildSellerEmail(orderId, order, company, sellerTo, siteUrl);
    else logger.warn(`Seller email for order ${orderId} not sent: no recipient.`);

    const kinds = (Object.keys(emails) as Kind[]);
    if (kinds.length === 0) return;
    const reserved = await reserve(db, orderRef, kinds, now);

    const results = await Promise.all(
      reserved.map(async (kind) => ({ kind, failure: await post(fetchImpl, apiKey, from, emails[kind] as OrderEmail, `order-${orderId}-${kind}`, timeoutMs) })),
    );
    const failed = results.filter(({ failure }) => failure !== null);
    for (const { kind, failure } of failed) logger.error(`Could not send the ${kind} email for order ${orderId}: ${failure}`);
    if (failed.length > 0) {
      try {
        await release(db, orderRef, failed.map(({ kind }) => kind));
      } catch (error) {
        logger.error(`Could not release the email marks of order ${orderId}:`, errorCode(error));
      }
    }
  } catch (error) {
    logger.error(`Could not send the emails for order ${orderId}:`, errorCode(error));
  }
};
