// Vive en netlify/lib porque Netlify desplegaría como función cualquier archivo de netlify/functions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { docs, fakeDb, writes, failures, DELETE, verifyIdTokenMock } = vi.hoisted(() => {
  const DELETE = { __fieldValue: 'delete' };
  const docs = new Map<string, Record<string, unknown>>();
  const writes = { commits: 0, operations: 0 };
  const failures = { commit: null as Error | null };

  const docRef = (path: string) => ({
    path,
    get: async () => ({ id: path.split('/')[1], exists: docs.has(path), data: () => docs.get(path) }),
  });

  type Ref = { path: string };
  const fakeDb = {
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
    batch: () => {
      const operations: (() => void)[] = [];
      return {
        set: (ref: Ref, data: Record<string, unknown>) => { operations.push(() => docs.set(ref.path, { ...data })); },
        update: (ref: Ref, data: Record<string, unknown>) => {
          operations.push(() => {
            if (!docs.has(ref.path)) throw Object.assign(new Error('not found'), { code: 5 });
            const next = { ...docs.get(ref.path) };
            for (const [field, value] of Object.entries(data)) {
              if (value === DELETE) delete next[field];
              else next[field] = value;
            }
            docs.set(ref.path, next);
          });
        },
        delete: (ref: Ref) => { operations.push(() => docs.delete(ref.path)); },
        commit: async () => {
          if (failures.commit) throw failures.commit;
          writes.commits += 1;
          writes.operations += operations.length;
          operations.forEach((operation) => operation());
        },
      };
    },
  };

  return { docs, fakeDb, writes, failures, DELETE, verifyIdTokenMock: vi.fn() };
});

vi.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: vi.fn(),
  credential: { cert: vi.fn() },
  auth: () => ({ verifyIdToken: verifyIdTokenMock }),
  firestore: Object.assign(() => fakeDb, {
    FieldValue: { serverTimestamp: () => 'server-timestamp', delete: () => DELETE },
  }),
}));

import { handler } from '../functions/manage-card-provider';

type Response = { statusCode: number; body: string };

const SECRET = 'payphone-secret-TOKEN-123';

const call = async ({ method = 'POST', token = 'super-token' as string | null, body = {} as unknown, query = undefined as Record<string, string> | undefined } = {}) =>
  (await handler(
    {
      httpMethod: method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: method === 'POST' ? JSON.stringify(body) : null,
      queryStringParameters: query ?? null,
    } as never,
    {} as never,
  )) as Response;

const post = (body: object, token?: string | null) => call({ body, ...(token === undefined ? {} : { token }) });
const get = (companyId: string, token?: string | null) => call({ method: 'GET', query: { companyId }, ...(token === undefined ? {} : { token }) });

const parsed = (response: Response) => JSON.parse(response.body);
const payphone = (extra: object = {}) => ({ companyId: 'c1', provider: 'payphone', token: SECRET, storeId: 'store-1', ...extra });

const expectNoWrites = () => {
  expect(writes.commits).toBe(0);
  expect(writes.operations).toBe(0);
};

const logSpies: ReturnType<typeof vi.spyOn>[] = [];
const responses: Response[] = [];

describe('manage-card-provider', () => {
  beforeEach(() => {
    docs.clear();
    writes.commits = 0;
    writes.operations = 0;
    failures.commit = null;
    responses.length = 0;
    verifyIdTokenMock.mockReset();
    verifyIdTokenMock.mockImplementation(async (token: string) => {
      const uids: Record<string, string> = { 'super-token': 'super', 'admin-token': 'admin', 'orphan-token': 'orphan' };
      if (!uids[token]) throw Object.assign(new Error('Decoding Firebase ID token failed.'), { code: 'auth/argument-error' });
      return { uid: uids[token] };
    });
    logSpies.length = 0;
    for (const method of ['log', 'info', 'warn', 'error'] as const) {
      logSpies.push(vi.spyOn(console, method).mockImplementation(() => {}));
    }
    docs.set('users/super', { role: 'superadmin' });
    docs.set('users/admin', { role: 'companyadmin', companyId: 'c1' });
    docs.set('companies/c1', { name: 'Tienda' });
  });

  afterEach(() => {
    // Ni los logs ni las respuestas de ningún caso contienen el token de Payphone.
    for (const spy of logSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
    }
    for (const response of responses) {
      expect(response.body).not.toContain(SECRET);
    }
    vi.restoreAllMocks();
  });

  const track = async (promise: Promise<Response>) => {
    const response = await promise;
    responses.push(response);
    return response;
  };

  describe('sesión y rol', () => {
    it.each([[null], ['bad-token']])('devuelve 401 con el token %s y no escribe', async (token) => {
      expect((await track(post(payphone(), token))).statusCode).toBe(401);
      expect((await track(get('c1', token))).statusCode).toBe(401);
      expectNoWrites();
    });

    it('devuelve 503 si no se pudo comprobar el token y no escribe', async () => {
      verifyIdTokenMock.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'auth/argument-error' }));
      expect((await track(post(payphone()))).statusCode).toBe(503);
      expectNoWrites();
    });

    it.each([['companyadmin', 'admin-token'], ['sin documento de usuario', 'orphan-token']])('devuelve 403 a %s y no escribe', async (_label, token) => {
      expect((await track(post(payphone(), token))).statusCode).toBe(403);
      expect((await track(post({ companyId: 'c1', disable: true }, token))).statusCode).toBe(403);
      expect((await track(get('c1', token))).statusCode).toBe(403);
      expectNoWrites();
      expect(docs.get('companies/c1')).toEqual({ name: 'Tienda' });
    });

    it('devuelve 405 con otros métodos', async () => {
      expect((await track(call({ method: 'DELETE' }))).statusCode).toBe(405);
      expectNoWrites();
    });
  });

  describe('activar', () => {
    it('Payphone guarda las credenciales y cardProvider en un solo batch', async () => {
      const response = await track(post(payphone({ taxRate: 0.15 })));

      expect(response.statusCode).toBe(200);
      expect(parsed(response)).toEqual({ provider: 'payphone', storeId: 'store-1', taxRate: 0.15 });
      expect(writes.commits).toBe(1);
      expect(writes.operations).toBe(2);
      expect(docs.get('paymentCredentials/c1')).toEqual({
        provider: 'payphone',
        payphone: { token: SECRET, storeId: 'store-1', taxRate: 0.15 },
        updatedAt: 'server-timestamp',
      });
      expect(docs.get('companies/c1')).toEqual({ name: 'Tienda', cardProvider: 'payphone' });
    });

    it('Payphone sin IVA no guarda taxRate', async () => {
      const response = await track(post(payphone()));

      expect(parsed(response)).toEqual({ provider: 'payphone', storeId: 'store-1' });
      expect(docs.get('paymentCredentials/c1')?.payphone).toEqual({ token: SECRET, storeId: 'store-1' });
    });

    it.each([
      ['sin token', { token: undefined }],
      ['con token vacío', { token: '  ' }],
      ['sin storeId', { storeId: undefined }],
      ['con taxRate 1', { taxRate: 1 }],
      ['con taxRate -0.1', { taxRate: -0.1 }],
      ['con taxRate "x"', { taxRate: 'x' }],
      ['con taxRate "0.15" como texto', { taxRate: '0.15' }],
      ['con taxRate null', { taxRate: null }],
    ])('Payphone %s devuelve 422 y no escribe', async (_label, extra) => {
      const response = await track(post(payphone(extra)));

      expect(response.statusCode).toBe(422);
      expect(parsed(response).reason).toBe('validation');
      expectNoWrites();
      expect(docs.has('paymentCredentials/c1')).toBe(false);
    });

    it('Stripe pone cardProvider en stripe', async () => {
      const response = await track(post({ companyId: 'c1', provider: 'stripe' }));

      expect(response.statusCode).toBe(200);
      expect(parsed(response)).toEqual({ provider: 'stripe' });
      expect(writes.commits).toBe(1);
      expect(docs.get('paymentCredentials/c1')).toEqual({ provider: 'stripe', updatedAt: 'server-timestamp' });
      expect(docs.get('companies/c1')).toEqual({ name: 'Tienda', cardProvider: 'stripe' });
    });

    it('cambiar de Payphone a Stripe reemplaza las credenciales', async () => {
      await track(post(payphone()));
      await track(post({ companyId: 'c1', provider: 'stripe' }));

      expect(docs.get('paymentCredentials/c1')).toEqual({ provider: 'stripe', updatedAt: 'server-timestamp' });
      expect(docs.get('companies/c1')?.cardProvider).toBe('stripe');
    });

    it.each([
      ['proveedor desconocido', { companyId: 'c1', provider: 'paypal' }],
      ['provider y disable a la vez', { companyId: 'c1', provider: 'stripe', disable: true }],
      ['ni provider ni disable', { companyId: 'c1' }],
      ['disable distinto de true', { companyId: 'c1', disable: 'yes' }],
      ['sin companyId', { provider: 'stripe' }],
      ['companyId vacío', { companyId: ' ', provider: 'stripe' }],
      ['companyId con barra', { companyId: 'c1/x', provider: 'stripe' }],
    ])('devuelve 422 con %s y no escribe', async (_label, body) => {
      expect((await track(post(body))).statusCode).toBe(422);
      expectNoWrites();
    });

    it('devuelve 400 si el cuerpo no es JSON', async () => {
      const response = await track(handler({ httpMethod: 'POST', headers: { authorization: 'Bearer super-token' }, body: `{"token":"${SECRET}"` } as never, {} as never) as Promise<Response>);
      expect(response.statusCode).toBe(400);
      expectNoWrites();
    });

    it('devuelve 404 si la empresa no existe', async () => {
      const response = await track(post(payphone({ companyId: 'nope' })));

      expect(response.statusCode).toBe(404);
      expectNoWrites();
      expect(docs.has('paymentCredentials/nope')).toBe(false);
    });

    it('si falla la escritura devuelve 500 y no loguea el mensaje del error', async () => {
      failures.commit = Object.assign(new Error(`write failed for ${SECRET}`), { code: 14 });

      const response = await track(post(payphone()));

      expect(response.statusCode).toBe(500);
      expect(docs.has('paymentCredentials/c1')).toBe(false);
      expect(JSON.stringify(logSpies.map((spy) => spy.mock.calls))).toContain('14');
    });
  });

  describe('desactivar', () => {
    beforeEach(() => {
      docs.set('companies/c1', { name: 'Tienda', cardProvider: 'payphone' });
      docs.set('paymentCredentials/c1', { provider: 'payphone', payphone: { token: SECRET, storeId: 'store-1' } });
    });

    it('borra las credenciales y cardProvider en un solo batch', async () => {
      const response = await track(post({ companyId: 'c1', disable: true }));

      expect(response.statusCode).toBe(200);
      expect(parsed(response)).toEqual({ provider: null });
      expect(writes.commits).toBe(1);
      expect(writes.operations).toBe(2);
      expect(docs.has('paymentCredentials/c1')).toBe(false);
      expect(docs.get('companies/c1')).toEqual({ name: 'Tienda' });
    });

    it('con solo uno de transferencia o efectivo apagado, desactiva', async () => {
      docs.set('companies/c1', { name: 'Tienda', cardProvider: 'payphone', paymentMethods: { transfer: false, cash: true } });

      expect((await track(post({ companyId: 'c1', disable: true }))).statusCode).toBe(200);
      expect(docs.has('paymentCredentials/c1')).toBe(false);
    });

    it('con transferencia y efectivo apagados devuelve 422 y no cambia nada', async () => {
      const company = { name: 'Tienda', cardProvider: 'payphone', paymentMethods: { transfer: false, cash: false } };
      docs.set('companies/c1', company);

      const response = await track(post({ companyId: 'c1', disable: true }));

      expect(response.statusCode).toBe(422);
      expect(parsed(response).reason).toBe('last-payment-method');
      expectNoWrites();
      expect(docs.get('companies/c1')).toEqual(company);
      expect(docs.has('paymentCredentials/c1')).toBe(true);
    });

    it('devuelve 404 si la empresa no existe', async () => {
      expect((await track(post({ companyId: 'nope', disable: true }))).statusCode).toBe(404);
      expectNoWrites();
    });
  });

  describe('consultar', () => {
    it('devuelve Payphone con storeId e IVA, sin el token', async () => {
      docs.set('paymentCredentials/c1', { provider: 'payphone', payphone: { token: SECRET, storeId: 'store-1', taxRate: 0.15 } });

      const response = await track(get('c1'));

      expect(response.statusCode).toBe(200);
      expect(parsed(response)).toEqual({ provider: 'payphone', storeId: 'store-1', taxRate: 0.15 });
      expect(response.body).not.toContain(SECRET);
    });

    it('devuelve Stripe', async () => {
      docs.set('paymentCredentials/c1', { provider: 'stripe' });
      expect(parsed(await track(get('c1')))).toEqual({ provider: 'stripe' });
    });

    it('devuelve provider null sin credenciales o con credenciales inválidas', async () => {
      expect(parsed(await track(get('c1')))).toEqual({ provider: null });
      docs.set('paymentCredentials/c1', { provider: 'payphone', payphone: { token: SECRET } });
      expect(parsed(await track(get('c1')))).toEqual({ provider: null });
    });

    it('devuelve 422 sin companyId', async () => {
      expect((await track(call({ method: 'GET' }))).statusCode).toBe(422);
    });
  });
});
