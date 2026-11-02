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
    const verifier = { verifyIdToken: async () => { throw Object.assign(new Error('bad'), { code: 'auth/argument-error' }); } };

    await expect(verifyIdToken('token-secreto', verifier)).resolves.toBeNull();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('token-secreto');
  });
});
