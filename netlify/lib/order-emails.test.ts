import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESEND_API_URL, sendOrderEmails, type OrderEmailDeps } from './order-emails';
import { createFakeFirestore } from './testing/fake-firestore';
import { jsonReply } from './testing/payment-fixtures';

const ORDER_ID = '7f3k2a9qWXYZ12';
const NUMBER = '7F3K2A9Q';
const BUYER = { name: 'Ana Pérez', email: 'ana@example.com', phone: '0991234567', address: 'Calle 1', city: 'Quito' };
const PERSONAL = [BUYER.name, BUYER.email, BUYER.phone, 'tienda@example.com', 'admin@example.com'];

/** Ana: 2 tazas de $20 y un llavero de $2, envío de $5 y cupón de $2 = $45. */
const baseOrder = {
  companyId: 'c1',
  userId: 'u1',
  customer: BUYER,
  items: [
    {
      productId: 'taza',
      productName: 'Taza',
      quantity: 2,
      price: 20,
      customization: { text: 'Sofía', color: 'Rojo', date: '' },
      customizationLabels: { text: 'Nombre a grabar', color: 'Color del lazo' },
    },
    { productId: 'llavero', productName: 'Llavero', quantity: 1, price: 2, customization: {} },
  ],
  total: 45,
  shippingMethod: 'Courier',
  shippingCost: 5,
  couponCode: 'PROMO',
  discount: 2,
  payment: { method: 'transfer', last4: '' },
  status: 'Pendiente de pago',
};

const baseCompany = {
  name: 'Gisam Lifestyle',
  adminUid: 'admin1',
  contact: { email: 'tienda@example.com' },
  settings: { defaultLanguage: 'es', transferText: 'Banco Pichincha\nCuenta 123', cashText: 'Paga al recibir en Quito' },
};

let fake: ReturnType<typeof createFakeFirestore>;
let fetch: ReturnType<typeof vi.fn>;
let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
let env: Record<string, string | undefined>;

const seed = ({ order = {}, company = {} }: { order?: object; company?: object } = {}) => {
  fake.docs.set('companies/c1', { ...baseCompany, ...company });
  fake.docs.set('users/admin1', { email: 'admin@example.com', role: 'companyadmin' });
  fake.docs.set(`orders/${ORDER_ID}`, { ...baseOrder, ...order });
};

const deps = (extra: Partial<OrderEmailDeps> = {}): OrderEmailDeps => ({
  fetch,
  env,
  logger,
  serverTimestamp: () => 'server-timestamp',
  ...extra,
});

const send = (extra: Partial<OrderEmailDeps> = {}) => sendOrderEmails(fake.db, ORDER_ID, deps(extra));

type Sent = { url: string; headers: Record<string, string>; body: { from: string; to: string[]; subject: string; html: string; text: string; reply_to?: string } };
const sent = (): Sent[] => fetch.mock.calls.map(([url, init]) => ({ url, headers: init.headers, body: JSON.parse(init.body) }));
const sentTo = (email: string) => {
  const matches = sent().filter(({ body }) => body.to.includes(email));
  expect(matches).toHaveLength(1);
  return matches[0];
};
const notifications = () => fake.docs.get(`orders/${ORDER_ID}`)?.notifications as Record<string, unknown> | undefined;
const logs = () => JSON.stringify([logger.warn.mock.calls, logger.error.mock.calls]);
const expectNoPersonalData = () => {
  for (const value of PERSONAL) expect(logs()).not.toContain(value);
};

describe('order-emails', () => {
  beforeEach(() => {
    fake = createFakeFirestore();
    fetch = vi.fn(async () => jsonReply({ id: 'email-1' }));
    logger = { warn: vi.fn(), error: vi.fn() };
    env = { RESEND_API_KEY: 're_test_key', RESEND_FROM: 'Pedidos <pedidos@tienda.example>', URL: 'https://tienda.example/' };
    seed();
  });

  describe('destinatarios y envío', () => {
    it('envía con Resend el correo del comprador a customer.email y el del vendedor a contact.email, y guarda las marcas', async () => {
      await send();

      expect(fetch).toHaveBeenCalledTimes(2);
      for (const { url, headers, body } of sent()) {
        expect(url).toBe(RESEND_API_URL);
        expect(headers.Authorization).toBe('Bearer re_test_key');
        expect(headers['Content-Type']).toBe('application/json');
        expect(body.from).toBe('Pedidos <pedidos@tienda.example>');
        expect(body.html).toContain('<html');
        expect(body.text.length).toBeGreaterThan(0);
      }
      const buyer = sentTo(BUYER.email);
      expect(buyer.headers['Idempotency-Key']).toBe(`order-${ORDER_ID}-buyer`);
      expect(buyer.body.reply_to).toBe('tienda@example.com');
      const seller = sentTo('tienda@example.com');
      expect(seller.headers['Idempotency-Key']).toBe(`order-${ORDER_ID}-seller`);
      expect(seller.body.reply_to).toBeUndefined();
      expect(notifications()).toEqual({ buyerEmailSentAt: 'server-timestamp', sellerEmailSentAt: 'server-timestamp' });
      expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('sin correo de contacto, el aviso de venta va al correo del companyadmin (users/<adminUid>)', async () => {
      seed({ company: { contact: { email: '' } } });

      await send();

      sentTo('admin@example.com');
      expect(sentTo(BUYER.email).body.reply_to).toBeUndefined();
    });

    it('sin ningún destinatario de la tienda solo envía el del comprador y lo registra sin datos personales', async () => {
      seed({ company: { contact: {}, adminUid: undefined } });

      await send();

      expect(fetch).toHaveBeenCalledTimes(1);
      sentTo(BUYER.email);
      expect(notifications()).toEqual({ buyerEmailSentAt: 'server-timestamp' });
      expect(logs()).toContain('Seller email');
      expectNoPersonalData();
    });

    it('sin correo del comprador solo envía el aviso de venta', async () => {
      seed({ order: { customer: { ...BUYER, email: 'no-es-un-correo' } } });

      await send();

      expect(fetch).toHaveBeenCalledTimes(1);
      sentTo('tienda@example.com');
      expect(notifications()).toEqual({ sellerEmailSentAt: 'server-timestamp' });
    });

    it('sin RESEND_API_KEY no envía, no escribe y lo registra en el log', async () => {
      delete env.RESEND_API_KEY;

      await send();

      expect(fetch).not.toHaveBeenCalled();
      expect(fake.writes).toEqual([]);
      expect(logs()).toContain('RESEND_API_KEY is not set');
    });

    it('sin RESEND_FROM tampoco envía y lo registra en el log', async () => {
      env.RESEND_FROM = '  ';

      await send();

      expect(fetch).not.toHaveBeenCalled();
      expect(fake.writes).toEqual([]);
      expect(logs()).toContain('RESEND_FROM is not set');
    });

    it('si el pedido no existe no envía ni lanza', async () => {
      fake.docs.delete(`orders/${ORDER_ID}`);

      await expect(send()).resolves.toBeUndefined();

      expect(fetch).not.toHaveBeenCalled();
      expect(logs()).toContain('order not found');
    });
  });

  describe('una sola vez por pedido', () => {
    it('enviar dos veces seguidas manda cada correo una sola vez', async () => {
      await send();
      await send();

      expect(fetch).toHaveBeenCalledTimes(2);
      sentTo(BUYER.email);
      sentTo('tienda@example.com');
    });

    it('enviar dos veces a la vez (doble confirmación del pago) manda cada correo una sola vez', async () => {
      await Promise.all([send(), send(), send()]);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(notifications()).toEqual({ buyerEmailSentAt: 'server-timestamp', sellerEmailSentAt: 'server-timestamp' });
    });

    it('con la marca de un correo ya guardada solo envía el otro', async () => {
      seed({ order: { notifications: { buyerEmailSentAt: 'antes' } } });

      await send();

      expect(fetch).toHaveBeenCalledTimes(1);
      sentTo('tienda@example.com');
      expect(notifications()).toEqual({ buyerEmailSentAt: 'antes', sellerEmailSentAt: 'server-timestamp' });
    });
  });

  describe('fallos de Resend', () => {
    it('con un 500 no lanza, libera las reservas y registra solo el código, sin datos personales', async () => {
      fetch.mockResolvedValue(jsonReply({ message: `Invalid to: ${BUYER.email}` }, 500));

      await expect(send()).resolves.toBeUndefined();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(notifications()).toEqual({});
      expect(logs()).toContain('HTTP 500');
      expectNoPersonalData();

      // Una confirmación posterior lo reintenta.
      fetch.mockResolvedValue(jsonReply({ id: 'email-2' }));
      await send();
      expect(fetch).toHaveBeenCalledTimes(4);
      expect(notifications()).toEqual({ buyerEmailSentAt: 'server-timestamp', sellerEmailSentAt: 'server-timestamp' });
    });

    it('si falla solo un correo, libera solo su marca', async () => {
      fetch.mockImplementation(async (_url: string, init: { body: string }) =>
        JSON.parse(init.body).to.includes(BUYER.email) ? jsonReply({}, 422) : jsonReply({ id: 'ok' }),
      );

      await send();

      expect(notifications()).toEqual({ sellerEmailSentAt: 'server-timestamp' });
      expect(logs()).toContain('buyer email');
      expect(logs()).toContain('HTTP 422');
    });

    it('si Resend no responde, corta por timeout, libera las reservas y lo registra sin datos personales', async () => {
      fetch.mockImplementation(() => new Promise(() => {}));

      await send({ timeoutMs: 20 });

      expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
      expect(notifications()).toEqual({});
      expect(logs()).toContain('timeout');
      expectNoPersonalData();
    });

    it('con un error de red registra solo el nombre del error', async () => {
      fetch.mockRejectedValue(Object.assign(new TypeError(`fetch failed for ${BUYER.email}`), { cause: BUYER.phone }));

      await send();

      expect(notifications()).toEqual({});
      expect(logs()).toContain('TypeError');
      expectNoPersonalData();
    });

    it('si Firestore falla no lanza ni envía', async () => {
      fake.failures.write = Object.assign(new Error(`down ${BUYER.email}`), { code: 14 });

      await expect(send()).resolves.toBeUndefined();

      expect(fetch).not.toHaveBeenCalled();
      expect(logs()).toContain('14');
      expectNoPersonalData();
    });
  });

  describe('contenido', () => {
    it('el del comprador lleva número, artículos con cantidad y precio, envío, descuento, total e instrucciones de transferencia', async () => {
      await send();

      const { subject, html, text } = sentTo(BUYER.email).body;
      expect(subject).toBe(`Tu pedido ${NUMBER} en Gisam Lifestyle`);
      for (const content of [html, text]) {
        expect(content).toContain(NUMBER);
        expect(content).toContain('Taza × 2');
        expect(content).toContain('$20.00 c/u');
        expect(content).toContain('$40.00');
        expect(content).toContain('Llavero × 1');
        expect(content).toContain('$2.00 c/u');
        expect(content).toContain('Envío (Courier)');
        expect(content).toContain('$5.00');
        expect(content).toContain('Descuento (PROMO)');
        expect(content).toContain('-$2.00');
        expect(content).toContain('$45.00');
        expect(content).toContain('Transferencia bancaria');
        expect(content).toContain(`Envía el comprobante indicando tu número de pedido: ${NUMBER}.`);
      }
      expect(html).toContain('Banco Pichincha<br>Cuenta 123');
      expect(text).toContain('Banco Pichincha\nCuenta 123');
    });

    it('sin descuento no muestra la línea de descuento', async () => {
      seed({ order: { discount: 0, couponCode: undefined, total: 47 } });

      await send();

      const { html, text } = sentTo(BUYER.email).body;
      expect(html).not.toContain('Descuento');
      expect(text).not.toContain('Descuento');
      expect(text).toContain('$47.00');
    });

    it.each([
      ['efectivo', { payment: { method: 'cash', last4: '' } }, {}, ['Pago en efectivo', 'Paga al recibir en Quito']],
      ['transferencia sin texto de la tienda', {}, { settings: { defaultLanguage: 'es' } }, ['Realiza la transferencia a la siguiente cuenta y confirma tu pago.']],
      ['tarjeta', { payment: { method: 'card', provider: 'stripe', transactionId: 'cs_1' }, status: 'En producción' }, {}, ['Tarjeta: pago aprobado']],
    ])('el del comprador con %s muestra el texto del método de pago', async (_case, order, company, expected) => {
      seed({ order, company });

      await send();

      const { text } = sentTo(BUYER.email).body;
      for (const content of expected) expect(text).toContain(content);
    });

    it('el del vendedor lleva número, comprador, artículos con su personalización, total, método de pago y enlace al panel', async () => {
      await send();

      const { subject, html, text } = sentTo('tienda@example.com').body;
      expect(subject).toBe(`Nueva venta ${NUMBER} · $45.00`);
      for (const content of [html, text]) {
        expect(content).toContain(NUMBER);
        expect(content).toContain('Ana Pérez');
        expect(content).toContain(BUYER.email);
        expect(content).toContain(BUYER.phone);
        expect(content).toContain('Taza × 2');
        expect(content).toContain('Nombre a grabar: Sofía');
        expect(content).toContain('Color del lazo: Rojo');
        expect(content).not.toContain('date:');
        expect(content).toContain('$45.00');
        expect(content).toContain('Transferencia bancaria (pendiente de pago)');
      }
      expect(html).toContain(`href="https://tienda.example/admin/orders/${ORDER_ID}"`);
      expect(text).toContain(`https://tienda.example/admin/orders/${ORDER_ID}`);
    });

    it('el del vendedor de una venta con tarjeta indica pago aprobado y sin teléfono lo dice', async () => {
      seed({ order: { payment: { method: 'card' }, customer: { ...BUYER, phone: undefined } } });

      await send();

      const { text } = sentTo('tienda@example.com').body;
      expect(text).toContain('Tarjeta (pago aprobado)');
      expect(text).toContain('Teléfono: No indicado');
    });

    it('escapa los datos del pedido y de la tienda en el HTML', async () => {
      const script = '<script>alert(1)</script>';
      seed({
        order: {
          customer: { ...BUYER, name: script },
          items: [{ ...baseOrder.items[0], productName: '<b>Taza</b>', customization: { text: '"><img src=x>' } }],
        },
        company: { name: 'Tienda & <i>Co</i>', settings: { transferText: '<a href="x">banco</a>' } },
      });

      await send();

      for (const { body } of sent()) {
        expect(body.html).not.toContain('<script>');
        expect(body.html).not.toContain('<b>Taza</b>');
        expect(body.html).not.toContain('<img');
        expect(body.html).not.toContain('<i>Co</i>');
        expect(body.html).not.toContain('<a href="x">');
      }
      const buyer = sentTo(BUYER.email).body;
      expect(buyer.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(buyer.html).toContain('&lt;b&gt;Taza&lt;/b&gt;');
      expect(buyer.html).toContain('Tienda &amp; &lt;i&gt;Co&lt;/i&gt;');
      expect(buyer.html).toContain('&lt;a href=&quot;x&quot;&gt;banco&lt;/a&gt;');
      const seller = sentTo('tienda@example.com').body;
      expect(seller.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(seller.html).toContain('&quot;&gt;&lt;img src=x&gt;');
    });
  });

  describe('idioma', () => {
    it('con la tienda en inglés, el del comprador va en inglés y el del vendedor en español', async () => {
      seed({ order: { payment: { method: 'card' } }, company: { settings: { defaultLanguage: 'en' } } });

      await send();

      const buyer = sentTo(BUYER.email).body;
      expect(buyer.subject).toBe(`Your order ${NUMBER} at Gisam Lifestyle`);
      expect(buyer.html).toContain('lang="en"');
      expect(buyer.text).toContain('Hi Ana Pérez,');
      expect(buyer.text).toContain('$20.00 each');
      expect(buyer.text).toContain('Shipping (Courier)');
      expect(buyer.text).toContain('Discount (PROMO)');
      expect(buyer.text).toContain('Card: payment approved');
      expect(buyer.text).not.toContain('Envío');
      const seller = sentTo('tienda@example.com').body;
      expect(seller.subject).toBe(`Nueva venta ${NUMBER} · $45.00`);
      expect(seller.html).toContain('lang="es"');
      expect(seller.text).toContain('Comprador');
      expect(seller.text).toContain('Tarjeta (pago aprobado)');
    });

    it('con la tienda en español o sin idioma, el del comprador va en español', async () => {
      seed({ company: { settings: {} } });

      await send();

      const buyer = sentTo(BUYER.email).body;
      expect(buyer.subject).toBe(`Tu pedido ${NUMBER} en Gisam Lifestyle`);
      expect(buyer.html).toContain('lang="es"');
      expect(buyer.text).toContain('Hola Ana Pérez,');
    });

    it('en inglés, con transferencia, usa el texto por defecto en inglés si la tienda no tiene uno', async () => {
      seed({ company: { settings: { defaultLanguage: 'en' } } });

      await send();

      const { text } = sentTo(BUYER.email).body;
      expect(text).toContain('Bank transfer details');
      expect(text).toContain('Please make the transfer to the following account and confirm your payment.');
    });
  });
});
