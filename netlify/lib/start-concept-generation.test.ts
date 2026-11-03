// Vive en netlify/lib porque Netlify desplegaría como función cualquier archivo de netlify/functions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { docs, fakeDb, verifyIdTokenMock, fetchMock, transactionMock } = vi.hoisted(() => {
  const docs = new Map<string, Record<string, unknown>>();
  const transactionMock = { fail: false, failJobWrite: false };

  const docRef = (path: string) => ({
    path,
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      if (transactionMock.failJobWrite && path.startsWith('conceptJobs/')) throw new Error('firestore down');
      docs.set(path, options?.merge ? { ...docs.get(path), ...data } : data);
    },
  });

  const fakeDb = {
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
    runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
      if (transactionMock.fail) throw new Error('contention');
      return callback({
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (ref: { path: string }, data: Record<string, unknown>) => docs.set(ref.path, data),
      });
    },
  };

  return { docs, fakeDb, transactionMock, verifyIdTokenMock: vi.fn(), fetchMock: vi.fn() };
});

vi.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: vi.fn(),
  credential: { cert: vi.fn() },
  auth: () => ({ verifyIdToken: verifyIdTokenMock }),
  firestore: Object.assign(() => fakeDb, { FieldValue: { serverTimestamp: () => 'server-timestamp' } }),
}));

vi.mock('node-fetch', () => ({ default: fetchMock }));

import { handler } from '../functions/start-concept-generation';

type Response = { statusCode: number; headers?: Record<string, string>; body: string };

const call = async ({ method = 'POST', token = 'good-token' as string | null, body = {} as unknown, rawBody = undefined as string | undefined } = {}) =>
  (await handler(
    {
      httpMethod: method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: rawBody ?? JSON.stringify(body),
    } as never,
    {} as never,
  )) as Response;

const generate = (extra: object = {}) => call({ body: { companyId: 'c1', userInput: 'taza', ...extra } });

const setCompany = (overrides: { status?: string; settings?: object } = {}) =>
  docs.set('companies/c1', {
    name: 'Tienda Real',
    status: 'ACTIVE',
    ...overrides,
    settings: { enableAIAssistant: true, aiPrompt: 'prompt real', imageProvider: 'PEXELS', ...overrides.settings },
  });

const keysIn = (collection: string) => [...docs.keys()].filter((key) => key.startsWith(`${collection}/`));

describe('start-concept-generation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    docs.clear();
    transactionMock.fail = false;
    transactionMock.failJobWrite = false;
    delete process.env.AI_GENERATIONS_PER_HOUR;
    delete process.env.AI_COMPANY_GENERATIONS_PER_HOUR;
    delete process.env.DEPLOY_URL;
    process.env.URL = 'https://prod.example';
    process.env.INTERNAL_API_KEY = 'internal-key';
    verifyIdTokenMock.mockReset();
    verifyIdTokenMock.mockImplementation(async (token: string) => {
      if (token !== 'good-token') throw Object.assign(new Error('Decoding Firebase ID token failed.'), { code: 'auth/argument-error' });
      return { uid: 'u1' };
    });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 202 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setCompany();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('petición', () => {
    it('devuelve 405 si no es POST', async () => {
      expect((await call({ method: 'GET' })).statusCode).toBe(405);
    });

    it.each(['{no-json', 'null', '[]'])('devuelve 400 con el cuerpo %s', async (rawBody) => {
      expect((await call({ rawBody })).statusCode).toBe(400);
    });
  });

  describe('entrada', () => {
    const expectNothingStarted = () => {
      expect(keysIn('aiUsage')).toEqual([]);
      expect(keysIn('conceptJobs')).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    };

    it.each([
      ['ausente', undefined],
      ['que no es texto', 42],
      ['vacío', ''],
      ['solo con espacios', '   '],
      ['de 2001 caracteres', 'x'.repeat(2001)],
    ])('devuelve 400 con userInput %s, sin consumir cuota ni generar', async (_name, userInput) => {
      expect((await generate({ userInput })).statusCode).toBe(400);
      expectNothingStarted();
    });

    it.each([
      ['un array', []],
      ['null', null],
      ['texto', 'concepto'],
      ['de más de 10 KB', { description: 'x'.repeat(10 * 1024) }],
    ])('devuelve 400 con baseConcept %s, sin consumir cuota ni generar', async (_name, baseConcept) => {
      expect((await generate({ baseConcept })).statusCode).toBe(400);
      expectNothingStarted();
    });

    it('acepta los valores en el límite', async () => {
      const filler = 'x'.repeat(10 * 1024 - JSON.stringify({ d: '' }).length);

      const response = await generate({ userInput: 'x'.repeat(2000), baseConcept: { d: filler } });

      expect(response.statusCode).toBe(202);
    });

    it('comprueba la sesión antes que la entrada', async () => {
      expect((await call({ token: null, body: { companyId: 'c1', userInput: 42 } })).statusCode).toBe(401);
    });
  });

  describe('sesión', () => {
    it.each([[null], ['bad-token']])('devuelve 401 con el token %s, sin crear documento ni lanzar la función', async (token) => {
      const response = await call({ token, body: { companyId: 'c1', userInput: 'taza' } });

      expect(response.statusCode).toBe(401);
      expect(keysIn('conceptJobs')).toEqual([]);
      expect(keysIn('aiUsage')).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('si no se pudo comprobar el token devuelve 503, sin crear documento ni lanzar la función', async () => {
      verifyIdTokenMock.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'auth/argument-error' }));

      const response = await generate();

      expect(response.statusCode).toBe(503);
      expect(keysIn('conceptJobs')).toEqual([]);
      expect(keysIn('aiUsage')).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('comprueba el token antes que el companyId', async () => {
      expect((await call({ token: null, body: {} })).statusCode).toBe(401);
    });
  });

  describe('empresa', () => {
    it.each([[undefined], [''], [42], ['companies/otra/doc']])('devuelve 400 con companyId %j', async (companyId) => {
      expect((await generate({ companyId })).statusCode).toBe(400);
    });

    it('devuelve 404 si la empresa no existe', async () => {
      expect((await generate({ companyId: 'nope' })).statusCode).toBe(404);
    });

    it.each(['PENDING', 'REJECTED'])('devuelve 403 a una empresa %s y no consume el límite', async (status) => {
      setCompany({ status });

      expect((await generate()).statusCode).toBe(403);
      expect(keysIn('aiUsage')).toEqual([]);
      expect(keysIn('conceptJobs')).toEqual([]);
    });

    it.each([[false], [undefined], ['true']])('devuelve 403 con enableAIAssistant %j y no consume el límite', async (enableAIAssistant) => {
      setCompany({ settings: { enableAIAssistant } });

      expect((await generate()).statusCode).toBe(403);
      expect(keysIn('aiUsage')).toEqual([]);
      expect(keysIn('conceptJobs')).toEqual([]);
    });

    it('no acepta que el cuerpo active el asistente de una empresa que lo tiene desactivado', async () => {
      setCompany({ settings: { enableAIAssistant: false } });

      expect((await generate({ companySettings: { enableAIAssistant: true }, status: 'ACTIVE' })).statusCode).toBe(403);
    });

    it.each(['APPROVED', 'ACTIVE'])('acepta una empresa %s: responde 202 con jobId y crea el job', async (status) => {
      setCompany({ status });

      const response = await generate();

      expect(response.statusCode).toBe(202);
      const { jobId } = JSON.parse(response.body);
      expect(docs.get(`conceptJobs/${jobId}`)).toMatchObject({ status: 'pending', concepts: [] });
    });
  });

  describe('límite', () => {
    it('deja pasar 10 por defecto y la 11 da 429 con Retry-After, sin crear job', async () => {
      for (let i = 0; i < 10; i++) {
        expect((await generate()).statusCode).toBe(202);
      }

      const response = await generate();

      expect(response.statusCode).toBe(429);
      expect(Number(response.headers?.['Retry-After'])).toBeGreaterThan(0);
      expect(keysIn('conceptJobs')).toHaveLength(10);
      expect(fetchMock).toHaveBeenCalledTimes(10);
    });

    it('el tope de la empresa rechaza a otra cuenta con 429 e indica el alcance, sin crear job', async () => {
      process.env.AI_COMPANY_GENERATIONS_PER_HOUR = '1';
      verifyIdTokenMock.mockResolvedValueOnce({ uid: 'u1' }).mockResolvedValueOnce({ uid: 'u2' });

      expect((await generate()).statusCode).toBe(202);
      const response = await generate();

      expect(response.statusCode).toBe(429);
      expect(JSON.parse(response.body).scope).toBe('company');
      expect(Number(response.headers?.['Retry-After'])).toBeGreaterThan(0);
      expect(keysIn('conceptJobs')).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('usa el valor de AI_GENERATIONS_PER_HOUR', async () => {
      process.env.AI_GENERATIONS_PER_HOUR = '2';

      expect((await generate()).statusCode).toBe(202);
      expect((await generate()).statusCode).toBe(202);
      expect((await generate()).statusCode).toBe(429);
    });

    it('usa 10 si AI_GENERATIONS_PER_HOUR no es válido', async () => {
      process.env.AI_GENERATIONS_PER_HOUR = 'muchas';

      for (let i = 0; i < 10; i++) {
        expect((await generate()).statusCode).toBe(202);
      }
      expect((await generate()).statusCode).toBe(429);
    });

    it('no cuenta las peticiones rechazadas por 401 o 403', async () => {
      process.env.AI_GENERATIONS_PER_HOUR = '1';
      await call({ token: 'bad-token', body: { companyId: 'c1' } });
      setCompany({ status: 'PENDING' });
      await generate();
      setCompany();

      expect((await generate()).statusCode).toBe(202);
    });

    describe('devuelve el cupo si la generación no llega a lanzarse', () => {
      const counts = () => keysIn('aiUsage').map((key) => docs.get(key)?.count);

      it('si la función de fondo responde con un error', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500 });

        expect((await generate()).statusCode).toBe(500);
        expect(counts()).toEqual([0, 0]);
      });

      it('si la llamada a la función de fondo falla por red', async () => {
        fetchMock.mockRejectedValue(new Error('network'));

        expect((await generate()).statusCode).toBe(500);
        expect(counts()).toEqual([0, 0]);
      });

      it('si no se puede crear el job', async () => {
        transactionMock.failJobWrite = true;

        expect((await generate()).statusCode).toBe(500);
        expect(counts()).toEqual([0, 0]);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('reintentar tras los fallos no agota el límite', async () => {
        process.env.AI_GENERATIONS_PER_HOUR = '1';
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

        expect((await generate()).statusCode).toBe(500);
        expect((await generate()).statusCode).toBe(202);
      });

      it('una generación lanzada sigue contando', async () => {
        expect((await generate()).statusCode).toBe(202);
        expect(counts()).toEqual([1, 1]);
      });

      it('si tampoco se puede devolver el cupo, sigue respondiendo 500', async () => {
        fetchMock.mockImplementation(async () => {
          transactionMock.fail = true;
          return { ok: false, status: 500 };
        });

        expect((await generate()).statusCode).toBe(500);
        expect(counts()).toEqual([1, 1]);
      });
    });

    it('falla cerrada: si la transacción falla responde 500 y no genera', async () => {
      transactionMock.fail = true;

      expect((await generate()).statusCode).toBe(500);
      expect(fetchMock).not.toHaveBeenCalled();
      // El job aún no existía: el catch no debe crear un documento `failed`.
      expect(keysIn('conceptJobs')).toEqual([]);
    });
  });

  describe('función de fondo', () => {
    const backgroundCall = () => {
      const [url, init] = fetchMock.mock.calls[0] as [string, { body: string; headers: Record<string, string> }];
      return { url, headers: init.headers, body: JSON.parse(init.body) };
    };

    it('recibe los ajustes de Firestore e ignora companySettings del cuerpo', async () => {
      await generate({
        baseConcept: { name: 'base' },
        companySettings: { name: 'Falsa', aiPrompt: 'prompt inyectado', imageProvider: 'GOOGLE_IMAGEN' },
      });

      const { body, headers } = backgroundCall();
      expect(body.companySettings).toEqual({ name: 'Tienda Real', aiPrompt: 'prompt real', imageProvider: 'PEXELS' });
      expect(body).toMatchObject({ userInput: 'taza', baseConcept: { name: 'base' } });
      expect(headers['x-internal-api-key']).toBe('internal-key');
    });

    it('usa DEPLOY_URL si existe', async () => {
      process.env.DEPLOY_URL = 'https://preview.example';

      await generate();

      expect(backgroundCall().url).toBe('https://preview.example/.netlify/functions/generate-concepts-background');
    });

    it('usa URL si no hay DEPLOY_URL', async () => {
      await generate();

      expect(backgroundCall().url).toBe('https://prod.example/.netlify/functions/generate-concepts-background');
    });

    it('responde 500 sin consumir el límite si falta INTERNAL_API_KEY', async () => {
      delete process.env.INTERNAL_API_KEY;

      expect((await generate()).statusCode).toBe(500);
      expect(keysIn('aiUsage')).toEqual([]);
      expect(keysIn('conceptJobs')).toEqual([]);
    });

    it('marca el job como fallido si la función de fondo responde con un error', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      expect((await generate()).statusCode).toBe(500);
      const [jobKey] = keysIn('conceptJobs');
      expect(docs.get(jobKey)).toMatchObject({ status: 'failed' });
    });

    it('marca el job como fallido si no se puede lanzar', async () => {
      fetchMock.mockRejectedValue(new Error('down'));

      expect((await generate()).statusCode).toBe(500);
      const [jobKey] = keysIn('conceptJobs');
      expect(docs.get(jobKey)).toMatchObject({ status: 'failed' });
    });
  });
});
