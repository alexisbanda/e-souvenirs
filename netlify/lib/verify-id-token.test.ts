import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBearerToken, verifyIdToken } from './verify-id-token';

describe('getBearerToken', () => {
  it('extrae el token de la cabecera, en minúsculas o no', () => {
    expect(getBearerToken({ authorization: 'Bearer abc' })).toBe('abc');
    expect(getBearerToken({ Authorization: 'bearer abc' })).toBe('abc');
  });

  it.each([{}, { authorization: '' }, { authorization: 'Basic abc' }, { authorization: 'Bearer ' }, { authorization: 'Bearer a b' }])(
    'devuelve null con %j',
    (headers) => {
      expect(getBearerToken(headers)).toBeNull();
    },
  );
});

describe('verifyIdToken', () => {
  afterEach(() => vi.restoreAllMocks());

  it('devuelve el uid de un token válido', async () => {
    await expect(verifyIdToken('t', { verifyIdToken: async () => ({ uid: 'u1' }) })).resolves.toBe('u1');
  });

  it('devuelve null si el token no es válido y no registra el token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const verifier = { verifyIdToken: async () => { throw Object.assign(new Error('Firebase ID token has invalid signature.'), { code: 'auth/argument-error' }); } };

    await expect(verifyIdToken('token-secreto', verifier)).resolves.toBeNull();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('token-secreto');
  });

  const failingVerifier = (code: string | undefined, message: string) => ({
    verifyIdToken: async () => { throw Object.assign(new Error(message), { code }); },
  });

  it.each([
    ['auth/id-token-expired', 'Firebase ID token has expired.'],
    ['auth/argument-error', 'Decoding Firebase ID token failed.'],
    ['auth/argument-error', 'Firebase ID token has incorrect "aud" (audience) claim.'],
    ['auth/argument-error', 'First argument to verifyIdToken() must be a Firebase ID token string.'],
  ])('un token descartado (%s: %s) devuelve null', async (code, message) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(verifyIdToken('t', failingVerifier(code, message))).resolves.toBeNull();
  });

  it.each([
    ['auth/argument-error', 'Error fetching public keys for Google certs: boom'],
    ['auth/argument-error', 'getaddrinfo ENOTFOUND www.googleapis.com'],
    ['auth/invalid-credential', 'Must initialize app with a cert credential.'],
    ['auth/internal-error', 'Firebase ID token could not be checked.'],
    [undefined, 'socket hang up'],
  ])('si no se pudo comprobar (%s: %s) lanza el error', async (code, message) => {
    await expect(verifyIdToken('t', failingVerifier(code, message))).rejects.toThrow(message);
  });
});
