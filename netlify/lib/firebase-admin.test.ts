import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apps, initializeApp, cert } = vi.hoisted(() => ({
  apps: [] as unknown[],
  initializeApp: vi.fn(),
  cert: vi.fn((account: unknown) => ({ account })),
}));

vi.mock('firebase-admin', () => ({ apps, initializeApp, credential: { cert } }));

import { getFirebaseAdmin } from './firebase-admin';

describe('getFirebaseAdmin', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    apps.length = 0;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('inicializa con la cuenta de servicio, sus saltos de línea y el bucket', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ client_email: 'a@b.c', private_key: 'l1\\nl2' });
    process.env.GCS_BUCKET_NAME = 'bucket';

    getFirebaseAdmin();

    expect(cert).toHaveBeenCalledWith({ client_email: 'a@b.c', private_key: 'l1\nl2' });
    expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({ storageBucket: 'bucket' }));
  });

  it('no inicializa dos veces', () => {
    apps.push({});

    getFirebaseAdmin();

    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('falla si falta la clave', () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    expect(() => getFirebaseAdmin()).toThrow('FIREBASE_SERVICE_ACCOUNT_KEY is not set.');
  });

  it('con JSON inválido no cita la clave en el error', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '{clave-secreta';

    expect(() => getFirebaseAdmin()).toThrow('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
    expect(() => getFirebaseAdmin()).not.toThrow(/clave-secreta/);
  });
});
