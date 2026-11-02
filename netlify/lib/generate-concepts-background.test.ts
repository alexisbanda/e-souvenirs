// Vive en netlify/lib porque Netlify desplegaría como función cualquier archivo de netlify/functions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ client_email: 'a@b.c', private_key: 'key' });
});

vi.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: vi.fn(),
  credential: { cert: vi.fn() },
  firestore: () => ({ collection: vi.fn() }),
  storage: vi.fn(),
}));
vi.mock('@google-cloud/aiplatform', () => ({ PredictionServiceClient: class {}, helpers: {} }));
vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: vi.fn(), SchemaType: {} }));
vi.mock('pexels', () => ({ createClient: vi.fn() }));
vi.mock('sharp', () => ({ default: vi.fn() }));

import { GoogleGenerativeAI } from '@google/generative-ai';
import { handler } from '../functions/generate-concepts-background';

type Response = { statusCode: number };

const call = async (headers: Record<string, string> = {}) =>
  (await handler(
    { httpMethod: 'POST', headers, body: JSON.stringify({ jobId: 'j1', userInput: 'taza' }) } as never,
    {} as never,
  )) as Response;

describe('generate-concepts-background', () => {
  const originalKey = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('rechaza la petición si INTERNAL_API_KEY no está configurada', async () => {
    delete process.env.INTERNAL_API_KEY;

    expect((await call()).statusCode).toBe(403);
    expect((await call({ 'x-internal-api-key': 'undefined' })).statusCode).toBe(403);
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it('rechaza una clave incorrecta', async () => {
    process.env.INTERNAL_API_KEY = 'internal-key';

    expect((await call({ 'x-internal-api-key': 'otra' })).statusCode).toBe(403);
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
  });
});
