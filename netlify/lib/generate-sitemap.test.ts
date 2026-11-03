// Vive en netlify/lib porque Netlify desplegaría como función cualquier archivo de netlify/functions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, whereMock } = vi.hoisted(() => {
  const getMock = vi.fn();
  return { getMock, whereMock: vi.fn(() => ({ get: getMock })) };
});

vi.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: vi.fn(),
  credential: { cert: vi.fn() },
  firestore: () => ({ collection: () => ({ where: whereMock }) }),
}));

import { handler } from '../functions/generate-sitemap';

type Response = { statusCode: number; headers?: Record<string, string>; body: string };

const call = async () => (await handler({} as never, {} as never)) as Response;
const companies = (...slugs: unknown[]) => ({ docs: slugs.map((slug) => ({ data: () => ({ slug }) })) });

describe('generate-sitemap', () => {
  const originalUrl = process.env.URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.URL = 'https://tienda.example';
    getMock.mockResolvedValue(companies('una', 'dos'));
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.URL;
    else process.env.URL = originalUrl;
    vi.restoreAllMocks();
  });

  it('lista la portada y las tiendas públicas en la dirección principal del sitio', async () => {
    const { statusCode, headers, body } = await call();

    expect(statusCode).toBe(200);
    expect(headers?.['Content-Type']).toBe('application/xml');
    expect(body).toContain('<loc>https://tienda.example</loc>');
    expect(body).toContain('<loc>https://tienda.example/una</loc>');
    expect(body).toContain('<loc>https://tienda.example/dos</loc>');
  });

  it('solo pide empresas ACTIVE o APPROVED', async () => {
    await call();

    expect(whereMock).toHaveBeenCalledWith('status', 'in', ['ACTIVE', 'APPROVED']);
  });

  it('sin URL usa la dirección de Netlify', async () => {
    delete process.env.URL;

    expect((await call()).body).toContain('<loc>https://e-souvenirs.netlify.app/una</loc>');
  });

  it('omite las empresas sin slug y codifica los que no son seguros en una URL', async () => {
    getMock.mockResolvedValue(companies('', undefined, 'a&b'));

    const { body } = await call();

    expect(body.match(/<loc>/g)).toHaveLength(2);
    expect(body).toContain('/a%26b</loc>');
  });

  it('si falla la lectura responde 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getMock.mockRejectedValue(new Error('boom'));

    expect((await call()).statusCode).toBe(500);
  });
});
