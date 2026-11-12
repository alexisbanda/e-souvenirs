// Vive en netlify/lib porque Netlify desplegaría como función cualquier archivo de netlify/functions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));

vi.mock('@google/generative-ai', () => ({
  SchemaType: { OBJECT: 'object', ARRAY: 'array', STRING: 'string' },
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: generateContentMock };
    }
  },
}));

import { handler } from '../functions/generate-business-descriptions';

type Response = { statusCode: number; body: string };

const call = async (body: object = {}, headers: Record<string, string> = {}) =>
  (await handler(
    { httpMethod: 'POST', headers, body: JSON.stringify({ companyName: 'Marca', seedDescription: 'tazas', ...body }) } as never,
    {} as never,
  )) as Response;

describe('generate-business-descriptions', () => {
  const originalEnv = { ...process.env };
  const siteverify = vi.fn();

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
    generateContentMock.mockReset();
    generateContentMock.mockResolvedValue({ response: { text: () => JSON.stringify({ options: [] }) } });
    siteverify.mockReset();
    siteverify.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', siteverify);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sin token devuelve 403 y no llama a Gemini ni a Cloudflare', async () => {
    const response = await call();

    expect(response.statusCode).toBe(403);
    expect(siteverify).not.toHaveBeenCalled();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('sin token devuelve 403 aunque el cuerpo esté vacío o falte GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;

    const response = await handler({ httpMethod: 'POST', headers: {}, body: '{}' } as never, {} as never) as Response;

    expect(response.statusCode).toBe(403);
  });

  it('con un token inválido devuelve 403 y no llama a Gemini', async () => {
    siteverify.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) });

    const response = await call({ turnstileToken: 'bad' });

    expect(response.statusCode).toBe(403);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('sin secreto devuelve 500, no llama a Gemini y no revela el motivo al cliente', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    const response = await call({ turnstileToken: 'tok' });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('TURNSTILE');
    expect(siteverify).not.toHaveBeenCalled();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('si Cloudflare falla devuelve 503 y no llama a Gemini', async () => {
    siteverify.mockRejectedValue(new TypeError('network'));

    expect((await call({ turnstileToken: 'tok' })).statusCode).toBe(503);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('con un token válido llama a Gemini y pasa la IP del visitante a Cloudflare', async () => {
    const response = await call({ turnstileToken: 'tok' }, { 'x-nf-client-connection-ip': '1.2.3.4' });

    expect(response.statusCode).toBe(200);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const form = siteverify.mock.calls[0][1].body as URLSearchParams;
    expect(form.get('remoteip')).toBe('1.2.3.4');
    expect(form.get('response')).toBe('tok');
  });

  it.each([
    ['seedDescription que no es texto', { seedDescription: 42 }],
    ['seedDescription objeto', { seedDescription: { a: 1 } }],
    ['seedDescription vacía', { seedDescription: '   ' }],
    ['seedDescription de 2001 caracteres', { seedDescription: 'x'.repeat(2001) }],
    ['companyName que no es texto', { companyName: 42 }],
    ['companyName null', { companyName: null }],
    ['companyName de 101 caracteres', { companyName: 'x'.repeat(101) }],
  ])('devuelve 400 con %s y no llama a Gemini', async (_name, body) => {
    expect((await call({ turnstileToken: 'tok', ...body })).statusCode).toBe(400);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('acepta los valores en el límite', async () => {
    const response = await call({ turnstileToken: 'tok', companyName: 'x'.repeat(100), seedDescription: 'x'.repeat(2000) });

    expect(response.statusCode).toBe(200);
  });

  it('si Gemini sigue saturado (503) responde ai_unavailable sin el texto de Google', async () => {
    vi.useFakeTimers();
    try {
      generateContentMock.mockRejectedValue(
        Object.assign(new Error('[503 Service Unavailable] This model is currently experiencing high demand.'), { status: 503 }),
      );

      const pending = call({ turnstileToken: 'tok' });
      await vi.runAllTimersAsync();
      const response = await pending;

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({ error: 'ai_unavailable' });
      // 2 intentos con el modelo principal + 2 con el de respaldo.
      expect(generateContentMock).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('si Gemini se recupera en el reintento devuelve 200', async () => {
    vi.useFakeTimers();
    try {
      generateContentMock.mockRejectedValueOnce(Object.assign(new Error('busy'), { status: 503 }));

      const pending = call({ turnstileToken: 'tok' });
      await vi.runAllTimersAsync();

      expect((await pending).statusCode).toBe(200);
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('un error no pasajero responde ai_error sin revelar el mensaje interno', async () => {
    generateContentMock.mockRejectedValue(new Error('secreto interno'));

    const response = await call({ turnstileToken: 'tok' });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'ai_error' });
  });

  it('devuelve 400 si el cuerpo no es JSON válido', async () => {
    const response = await handler({ httpMethod: 'POST', headers: {}, body: '{no' } as never, {} as never) as Response;

    expect(response.statusCode).toBe(400);
  });
});
