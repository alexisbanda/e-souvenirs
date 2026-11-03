// Contra el firebase-admin real, sin red: verify-id-token.ts distingue un token inválido
// de un fallo de infraestructura por los mensajes del SDK. Si una actualización los
// cambia, estos tests fallan aquí en lugar de dar 503 a los tokens inválidos en producción.
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { verifyIdToken } from './verify-id-token';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
// Ruta directa: el paquete no exporta este módulo y hay que simular la descarga de claves.
const { HttpClient } = require('../../node_modules/firebase-admin/lib/utils/api-request.js');

const PROJECT_ID = 'demo-contract';
const KID = 'k1';

const newKeys = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

describe('verifyIdToken con el firebase-admin real', () => {
  const { privateKey, publicKey } = newKeys();
  const originalSend = HttpClient.prototype.send;
  const originalEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const app = admin.initializeApp({ projectId: PROJECT_ID }, 'verify-id-token-contract');
  const auth = app.auth();

  const sign = (claims: object = {}, { key = privateKey, kid = KID, expiresIn = 3600 } = {}) =>
    jwt.sign(
      { aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`, sub: 'u1', auth_time: 1, ...claims },
      key,
      { algorithm: 'RS256', keyid: kid, expiresIn },
    );

  const respondWithKeys = () => {
    HttpClient.prototype.send = async () => ({ isJson: () => true, data: { [KID]: publicKey }, headers: {}, text: '' });
  };

  beforeAll(() => {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    respondWithKeys();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    respondWithKeys();
  });

  afterAll(async () => {
    HttpClient.prototype.send = originalSend;
    if (originalEmulatorHost !== undefined) process.env.FIREBASE_AUTH_EMULATOR_HOST = originalEmulatorHost;
    await app.delete();
  });

  it('devuelve el uid de un token válido', async () => {
    await expect(verifyIdToken(sign(), auth)).resolves.toBe('u1');
  });

  it.each([
    ['basura', () => 'no-es-un-jwt'],
    ['otra audiencia', () => sign({ aud: 'otro-proyecto' })],
    ['otro emisor', () => sign({ iss: 'https://securetoken.google.com/otro' })],
    ['caducado', () => sign({}, { expiresIn: -60 })],
    ['firma de otra clave', () => sign({}, { key: newKeys().privateKey })],
    ['clave desconocida', () => sign({}, { kid: 'otra' })],
  ])('un token con %s devuelve null', async (_name, token) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(verifyIdToken(token(), auth)).resolves.toBeNull();
  });

  it('si la red falla al pedir las claves, lanza el error', async () => {
    HttpClient.prototype.send = async () => {
      throw new Error('getaddrinfo ENOTFOUND www.googleapis.com');
    };

    await expect(verifyIdToken(sign(), auth)).rejects.toThrow('ENOTFOUND');
  });

  it('si Google responde con un error al pedir las claves, lanza el error', async () => {
    HttpClient.prototype.send = async () => ({
      isJson: () => true,
      data: { error: 'backend_error' },
      headers: {},
      text: '',
    });

    await expect(verifyIdToken(sign(), auth)).rejects.toThrow('public keys');
  });
});
