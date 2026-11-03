// Vive en netlify/lib porque Netlify desplegaría como función cualquier archivo de netlify/functions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { docs, fakeDb, failures, verifyIdTokenMock } = vi.hoisted(() => {
  const docs = new Map<string, Record<string, unknown>>();
  const failures = { orderWrite: false };

  const snapshot = (path: string) => ({
    id: path.split('/')[1],
    exists: docs.has(path),
    data: () => docs.get(path),
  });

  const docRef = (path: string) => ({ path, get: async () => snapshot(path) });

  const queryOn = (name: string, filters: [string, unknown][], max: number): unknown => ({
    where: (field: string, _op: string, value: unknown) => queryOn(name, [...filters, [field, value]], max),
    limit: (count: number) => queryOn(name, filters, count),
    get: async () => {
      const matches = [...docs.keys()]
        .filter((key) => key.startsWith(`${name}/`))
        .filter((key) => filters.every(([field, value]) => docs.get(key)?.[field] === value))
        .slice(0, max)
        .map(snapshot);
      return { empty: matches.length === 0, docs: matches };
    },
  });

  let nextOrder = 0;
  const fakeDb = {
    collection: (name: string) => ({
      doc: (id: string) => docRef(`${name}/${id}`),
      add: async (data: Record<string, unknown>) => {
        if (failures.orderWrite) throw Object.assign(new Error('firestore down: ada@example.com'), { code: 14 });
        const id = `order-${++nextOrder}`;
        docs.set(`${name}/${id}`, data);
        return { id };
      },
      where: (field: string, op: string, value: unknown) => (queryOn(name, [], Infinity) as { where: (...args: unknown[]) => unknown }).where(field, op, value),
    }),
    getAll: async (...refs: { path: string }[]) => refs.map((ref) => snapshot(ref.path)),
  };

  return { docs, fakeDb, failures, verifyIdTokenMock: vi.fn() };
});

vi.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: vi.fn(),
  credential: { cert: vi.fn() },
  auth: () => ({ verifyIdToken: verifyIdTokenMock }),
  firestore: Object.assign(() => fakeDb, { FieldValue: { serverTimestamp: () => 'server-timestamp' } }),
}));

import { handler } from '../functions/create-order';

type Response = { statusCode: number; body: string };

const validCustomer = { name: 'Ada Lovelace', email: 'ada@example.com', address: 'Calle 1', city: 'Quito', postalCode: '170150' };

const validBody = {
  companyId: 'c1',
  items: [{ productId: 'taza', quantity: 2, customization: { text: 'Ana' } }],
  shippingMethodId: 'envio',
  customer: validCustomer,
  paymentMethod: 'transfer',
};

const call = async ({ method = 'POST', token = 'good-token' as string | null, body = validBody as unknown, rawBody = undefined as string | undefined } = {}) =>
  (await handler(
    {
      httpMethod: method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: rawBody ?? JSON.stringify(body),
    } as never,
    {} as never,
  )) as Response;

const order = (extra: object = {}) => call({ body: { ...validBody, ...extra } });

const parsed = (response: Response) => JSON.parse(response.body);

const orderKeys = () => [...docs.keys()].filter((key) => key.startsWith('orders/'));
const savedOrder = () => docs.get(orderKeys()[0]) as Record<string, unknown>;

const setCoupon = (overrides: object = {}, id = 'cupon') =>
  docs.set(`coupons/${id}`, { code: 'PROMO', companyId: 'c1', discountType: 'percentage', discountValue: 10, isActive: true, ...overrides });

const timestamp = (date: Date) => ({ toDate: () => date });

const expectRejected = async (response: Response, statusCode: number, reason?: string) => {
  expect(response.statusCode).toBe(statusCode);
  if (reason) expect(parsed(response).reason).toBe(reason);
  expect(orderKeys()).toEqual([]);
};

describe('create-order', () => {
  beforeEach(() => {
    docs.clear();
    failures.orderWrite = false;
    verifyIdTokenMock.mockReset();
    verifyIdTokenMock.mockImplementation(async (token: string) => {
      if (token !== 'good-token') throw Object.assign(new Error('Decoding Firebase ID token failed.'), { code: 'auth/argument-error' });
      return { uid: 'u1' };
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    docs.set('companies/c1', { status: 'ACTIVE' });
    docs.set('companies/c2', { status: 'ACTIVE' });
    docs.set('products/taza', { name: 'Taza', price: 10, companyId: 'c1' });
    docs.set('products/ajeno', { name: 'Ajeno', price: 1, companyId: 'c2' });
    docs.set('shippingMethods/envio', { name: 'Courier', price: 5, companyId: 'c1' });
    docs.set('shippingMethods/envio-ajeno', { name: 'Otro', price: 1, companyId: 'c2' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('petición', () => {
    it('devuelve 405 si no es POST', async () => {
      await expectRejected(await call({ method: 'GET' }), 405);
    });

    it.each(['{no-json', 'null', '[]'])('devuelve 400 con el cuerpo %s', async (rawBody) => {
      await expectRejected(await call({ rawBody }), 400);
    });
  });

  describe('sesión', () => {
    it.each([[null], ['bad-token']])('devuelve 401 con el token %s y no crea nada', async (token) => {
      await expectRejected(await call({ token }), 401);
    });

    it('si no se pudo comprobar el token devuelve 503 y no crea nada', async () => {
      verifyIdTokenMock.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'auth/argument-error' }));

      await expectRejected(await call(), 503);
    });

    it('comprueba la sesión antes que la entrada', async () => {
      await expectRejected(await call({ token: null, body: { paymentMethod: 'card' } }), 401);
    });
  });

  describe('orden creada', () => {
    it.each(['transfer', 'cash'])('con %s crea la orden con 2 × $10, 10 % y envío de $5: total $23.00', async (paymentMethod) => {
      setCoupon();

      const response = await order({ couponCode: 'promo', paymentMethod });

      expect(response.statusCode).toBe(201);
      const [key] = orderKeys();
      expect(parsed(response)).toEqual({ orderId: key.split('/')[1], total: 23 });
      expect(savedOrder()).toEqual({
        userId: 'u1',
        companyId: 'c1',
        customer: validCustomer,
        items: [{ productId: 'taza', productName: 'Taza', quantity: 2, price: 10, customization: { text: 'Ana' } }],
        total: 23,
        shippingMethod: 'Courier',
        shippingCost: 5,
        payment: { method: paymentMethod, last4: '' },
        couponCode: 'PROMO',
        discount: 2,
        date: 'server-timestamp',
        status: 'Pendiente de pago',
      });
    });

    it('sin cupón guarda el código vacío y descuento 0', async () => {
      expect((await order()).statusCode).toBe(201);

      expect(savedOrder()).toMatchObject({ couponCode: '', discount: 0, total: 25 });
    });

    it.each([[''], [null]])('trata couponCode %j como sin cupón', async (couponCode) => {
      expect((await order({ couponCode })).statusCode).toBe(201);
      expect(savedOrder()).toMatchObject({ couponCode: '', total: 25 });
    });

    it('sin customization guarda un objeto vacío', async () => {
      expect((await order({ items: [{ productId: 'taza', quantity: 1 }] })).statusCode).toBe(201);

      expect((savedOrder().items as { customization: object }[])[0].customization).toEqual({});
    });

    it('admite dos líneas del mismo producto con distinta personalización', async () => {
      const items = [
        { productId: 'taza', quantity: 1, customization: { text: 'Ana' } },
        { productId: 'taza', quantity: 1, customization: { text: 'Luis' } },
      ];

      expect((await order({ items })).statusCode).toBe(201);
      expect(savedOrder().items).toHaveLength(2);
      expect(savedOrder().total).toBe(25);
    });

    it.each(['APPROVED', 'ACTIVE'])('acepta una tienda %s', async (status) => {
      docs.set('companies/c1', { status });

      expect((await order()).statusCode).toBe(201);
    });

    it('guarda importes sin errores de coma flotante: 3 × $19.99 con 15 %', async () => {
      docs.set('products/taza', { name: 'Taza', price: 19.99, companyId: 'c1' });
      docs.set('shippingMethods/envio', { name: 'Courier', price: 4.1, companyId: 'c1' });
      setCoupon({ discountValue: 15 });

      const response = await order({ couponCode: 'PROMO', items: [{ productId: 'taza', quantity: 3 }] });

      expect(parsed(response).total).toBe(55.07);
      expect(savedOrder()).toMatchObject({ total: 55.07, discount: 9, shippingCost: 4.1 });
    });
  });

  describe('datos manipulados', () => {
    it('ignora precios, totales, descuento, userId y estado del cuerpo', async () => {
      setCoupon();
      await order({ couponCode: 'PROMO' });
      const expected = { ...savedOrder() };
      docs.delete(orderKeys()[0]);

      const response = await order({
        couponCode: 'PROMO',
        total: 0.01,
        subtotal: 0.01,
        discount: 9999,
        shippingCost: 0,
        userId: 'victima',
        status: 'Entregado',
        date: 'ayer',
        payment: { method: 'card', last4: '4242' },
        items: [{ productId: 'taza', quantity: 2, customization: { text: 'Ana' }, price: 0.01, productName: 'Falso', total: 0.01 }],
      });

      expect(parsed(response).total).toBe(23);
      expect(savedOrder()).toEqual(expected);
    });

    it('guarda solo los campos conocidos del cliente', async () => {
      await order({ customer: { ...validCustomer, role: 'admin' } });

      expect(savedOrder().customer).toEqual(validCustomer);
    });
  });

  describe('forma de pago', () => {
    it.each([['card'], ['bitcoin'], [undefined], [1]])('devuelve 422 con paymentMethod %j y no crea nada', async (paymentMethod) => {
      await expectRejected(await order({ paymentMethod }), 422);
    });
  });

  describe('identificadores', () => {
    it.each([[undefined], [''], ['   '], [42], ['a/b'], ['.'], ['..'], ['__x__']])('devuelve 422 con companyId %j', async (companyId) => {
      await expectRejected(await order({ companyId }), 422);
    });

    it.each([[undefined], [''], [42], ['a/b'], ['..']])('devuelve 422 con shippingMethodId %j', async (shippingMethodId) => {
      await expectRejected(await order({ shippingMethodId }), 422);
    });

    it.each([[undefined], [''], [42], ['products/taza'], ['..']])('devuelve 422 con productId %j', async (productId) => {
      await expectRejected(await order({ items: [{ productId, quantity: 1 }] }), 422);
    });
  });

  describe('cliente', () => {
    it.each([
      ['no es un objeto', 'Ada'],
      ['falta el nombre', { ...validCustomer, name: undefined }],
      ['falta la ciudad', { ...validCustomer, city: undefined }],
      ['falta el código postal', { ...validCustomer, postalCode: undefined }],
      ['dirección solo con espacios', { ...validCustomer, address: '   ' }],
      ['el nombre no es texto', { ...validCustomer, name: 42 }],
      ['email sin arroba', { ...validCustomer, email: 'ada.example.com' }],
      ['email con espacios', { ...validCustomer, email: 'ada @example.com' }],
      ['nombre de 201 caracteres', { ...validCustomer, name: 'x'.repeat(201) }],
      ['email de 255 caracteres', { ...validCustomer, email: `${'x'.repeat(243)}@example.com` }],
      ['dirección de 301 caracteres', { ...validCustomer, address: 'x'.repeat(301) }],
      ['ciudad de 101 caracteres', { ...validCustomer, city: 'x'.repeat(101) }],
      ['código postal de 33 caracteres', { ...validCustomer, postalCode: 'x'.repeat(33) }],
    ])('devuelve 422 si %s y no crea nada', async (_name, customer) => {
      await expectRejected(await order({ customer }), 422);
    });

    it('acepta los valores en el límite', async () => {
      const customer = { name: 'x'.repeat(200), email: `${'x'.repeat(242)}@example.com`, address: 'x'.repeat(300), city: 'x'.repeat(100), postalCode: 'x'.repeat(32) };

      expect((await order({ customer })).statusCode).toBe(201);
    });
  });

  describe('líneas', () => {
    const line = (extra: object = {}) => ({ productId: 'taza', quantity: 1, ...extra });

    it.each([
      ['ausente', undefined],
      ['que no es una lista', 'taza'],
      ['vacía', []],
      ['de 51 líneas', Array.from({ length: 51 }, () => line())],
      ['con una línea que no es un objeto', ['taza']],
    ])('devuelve 422 con items %s y no crea nada', async (_name, items) => {
      await expectRejected(await order({ items }), 422);
    });

    it.each([[0], [-1], [1.5], [1001], ['2'], [undefined], [null]])('devuelve 422 con quantity %j y no crea nada', async (quantity) => {
      await expectRejected(await order({ items: [line({ quantity })] }), 422);
    });

    it.each([
      ['null', null],
      ['un array', []],
      ['texto', 'Ana'],
      ['de más de 10 KB', { text: 'x'.repeat(10 * 1024) }],
    ])('devuelve 422 con customization %s y no crea nada', async (_name, customization) => {
      await expectRejected(await order({ items: [line({ customization })] }), 422);
    });

    it('acepta los valores en el límite', async () => {
      const filler = 'x'.repeat(10 * 1024 - JSON.stringify({ text: '' }).length);
      const items = Array.from({ length: 50 }, () => line({ quantity: 1000, customization: { text: filler } }));

      expect((await order({ items })).statusCode).toBe(201);
      expect(savedOrder().total).toBe(500005);
    });
  });

  describe('tienda', () => {
    it('devuelve 404 si no existe y no crea nada', async () => {
      await expectRejected(await order({ companyId: 'nope' }), 404);
    });

    it.each(['PENDING', 'REJECTED', undefined])('devuelve 403 a una tienda %s y no crea nada', async (status) => {
      docs.set('companies/c1', { status });

      await expectRejected(await order(), 403);
    });
  });

  describe('productos', () => {
    it.each(['ajeno', 'nope'])('devuelve 422 con el producto %s y no crea nada', async (productId) => {
      await expectRejected(await order({ items: [{ productId, quantity: 1 }] }), 422);
    });

    it('rechaza el pedido entero si solo una línea es de otra empresa', async () => {
      await expectRejected(await order({ items: [{ productId: 'taza', quantity: 1 }, { productId: 'ajeno', quantity: 1 }] }), 422);
    });

    it.each([['texto', '10'], ['negativo', -1], ['ausente', undefined]])('devuelve 422 si el precio guardado es %s', async (_name, price) => {
      docs.set('products/taza', { name: 'Taza', price, companyId: 'c1' });

      await expectRejected(await order(), 422);
    });
  });

  describe('envío', () => {
    it.each(['envio-ajeno', 'nope'])('devuelve 422 con el envío %s y no crea nada', async (shippingMethodId) => {
      await expectRejected(await order({ shippingMethodId }), 422);
    });

    it('devuelve 422 si el precio guardado no es válido', async () => {
      docs.set('shippingMethods/envio', { name: 'Courier', price: 'gratis', companyId: 'c1' });

      await expectRejected(await order(), 422);
    });
  });

  describe('cupón', () => {
    it('busca el código en mayúsculas', async () => {
      setCoupon();

      expect((await order({ couponCode: 'pRoMo' })).statusCode).toBe(201);
      expect(savedOrder().couponCode).toBe('PROMO');
    });

    it.each([
      ['inexistente', 'NOPE'],
      ['que no es texto', 42],
      ['demasiado largo', 'X'.repeat(65)],
    ])('devuelve 422 invalid con un código %s y no crea nada', async (_name, couponCode) => {
      await expectRejected(await order({ couponCode }), 422, 'invalid');
    });

    it('devuelve 422 invalid si está inactivo', async () => {
      setCoupon({ isActive: false });

      await expectRejected(await order({ couponCode: 'PROMO' }), 422, 'invalid');
    });

    it('devuelve 422 invalid con un cupón de otra empresa', async () => {
      setCoupon({ companyId: 'c2' });

      await expectRejected(await order({ couponCode: 'PROMO' }), 422, 'invalid');
    });

    it.each([
      ['discountType desconocido', { discountType: 'regalo' }],
      ['discountValue no numérico', { discountValue: '10' }],
      ['discountValue negativo', { discountValue: -10 }],
      ['minPurchase no numérico', { minPurchase: 'mucho' }],
      ['validUntil que no es una fecha', { validUntil: 'mañana' }],
    ])('devuelve 422 invalid si el cupón guardado tiene %s', async (_name, overrides) => {
      setCoupon(overrides);

      await expectRejected(await order({ couponCode: 'PROMO' }), 422, 'invalid');
    });

    it('devuelve 422 expired si validUntil ya pasó', async () => {
      setCoupon({ validUntil: timestamp(new Date(Date.now() - 60_000)) });

      await expectRejected(await order({ couponCode: 'PROMO' }), 422, 'expired');
    });

    it('acepta un cupón con validUntil futuro', async () => {
      setCoupon({ validUntil: timestamp(new Date(Date.now() + 60_000)) });

      expect((await order({ couponCode: 'PROMO' })).statusCode).toBe(201);
    });

    it('devuelve 422 min-purchase por debajo de la compra mínima y no crea nada', async () => {
      setCoupon({ minPurchase: 20.01 });

      await expectRejected(await order({ couponCode: 'PROMO' }), 422, 'min-purchase');
    });

    it('la compra mínima no cuenta el envío y se cumple justo en el límite', async () => {
      setCoupon({ minPurchase: 20 });

      expect((await order({ couponCode: 'PROMO' })).statusCode).toBe(201);
    });

    it('un cupón fijo mayor que el subtotal deja solo el envío', async () => {
      setCoupon({ discountType: 'fixed', discountValue: 100 });

      const response = await order({ couponCode: 'PROMO' });

      expect(parsed(response).total).toBe(5);
      expect(savedOrder()).toMatchObject({ discount: 20, total: 5, shippingCost: 5 });
    });
  });

  describe('fallos', () => {
    it('responde 500 sin datos internos ni personales en la respuesta o los logs', async () => {
      failures.orderWrite = true;

      const response = await order();

      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('firestore');
      expect(response.body).not.toContain('ada@example.com');
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('ada@example.com');
      expect(orderKeys()).toEqual([]);
    });
  });
});
