import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiUnavailableError, generateContentWithRetry, getGeminiTextModelChain } from './gemini-retry';

const httpError = (status: number) => Object.assign(new Error(`[${status}]`), { status });
const ok = { response: { text: () => '{}' } };

const fakeGenAI = (generate: (model: string) => Promise<unknown>) => {
  const getGenerativeModel = vi.fn(({ model }: { model: string }) => ({ generateContent: () => generate(model) }));
  return { genAI: { getGenerativeModel } as unknown as GoogleGenerativeAI, getGenerativeModel };
};

const request = { contents: [] };
const sleep = vi.fn(async () => {});

describe('generateContentWithRetry', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.GEMINI_TEXT_MODEL;
    process.env.GEMINI_TEXT_FALLBACK_MODEL = 'respaldo';
    sleep.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('devuelve la respuesta al primer intento sin esperar', async () => {
    const { genAI } = fakeGenAI(async () => ok);

    await expect(generateContentWithRetry(genAI, request, { sleep })).resolves.toBe(ok);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('reintenta el mismo modelo tras un 503 y devuelve la respuesta', async () => {
    let calls = 0;
    const { genAI } = fakeGenAI(async () => (++calls === 1 ? Promise.reject(httpError(503)) : ok));

    await expect(generateContentWithRetry(genAI, request, { sleep, delayMs: 500 })).resolves.toBe(ok);
    expect(calls).toBe(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('pasa al modelo de respaldo cuando el principal sigue saturado', async () => {
    const models: string[] = [];
    const { genAI } = fakeGenAI(async (model) => {
      models.push(model);
      if (model === 'gemini-3.5-flash-lite') throw httpError(503);
      return ok;
    });

    await expect(generateContentWithRetry(genAI, request, { sleep })).resolves.toBe(ok);
    expect(models).toEqual(['gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'respaldo']);
  });

  it('lanza GeminiUnavailableError si todos los modelos fallan con errores pasajeros', async () => {
    const { genAI } = fakeGenAI(async () => Promise.reject(httpError(429)));

    await expect(generateContentWithRetry(genAI, request, { sleep })).rejects.toBeInstanceOf(GeminiUnavailableError);
  });

  it('no reintenta los errores no pasajeros (p. ej. 400) y los propaga tal cual', async () => {
    const error = httpError(400);
    const { genAI, getGenerativeModel } = fakeGenAI(async () => Promise.reject(error));

    await expect(generateContentWithRetry(genAI, request, { sleep })).rejects.toBe(error);
    expect(getGenerativeModel).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('getGeminiTextModelChain', () => {
  const originalEnv = { ...process.env };
  afterEach(() => { process.env = { ...originalEnv }; });

  it('no repite el modelo si el respaldo coincide con el principal', () => {
    process.env.GEMINI_TEXT_MODEL = 'mismo';
    process.env.GEMINI_TEXT_FALLBACK_MODEL = 'mismo';
    expect(getGeminiTextModelChain()).toEqual(['mismo']);
  });

  it('sin respaldo (none) solo usa el principal', () => {
    delete process.env.GEMINI_TEXT_MODEL;
    process.env.GEMINI_TEXT_FALLBACK_MODEL = 'none';
    expect(getGeminiTextModelChain()).toEqual(['gemini-3.5-flash-lite']);
  });
});
