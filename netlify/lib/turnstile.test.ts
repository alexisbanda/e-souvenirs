import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from './turnstile';

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

describe('verifyTurnstileToken', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('acepta un token válido y envía secreto, token e IP a siteverify', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));

    const result = await verifyTurnstileToken({ token: 'tok', remoteIp: '1.2.3.4', secret: 's3cret', fetchImpl });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const form = init.body as URLSearchParams;
    expect(Object.fromEntries(form)).toEqual({ secret: 's3cret', response: 'tok', remoteip: '1.2.3.4' });
  });

  it.each([undefined, '', 42, 'x'.repeat(2049)])('rechaza el token %j sin llamar a Cloudflare', async (token) => {
    const fetchImpl = vi.fn();

    await expect(verifyTurnstileToken({ token, secret: 's', fetchImpl })).resolves.toEqual({ ok: false, reason: 'missing-token' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falla cerrada sin secreto y lo registra', async () => {
    const fetchImpl = vi.fn();
    const previous = process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(verifyTurnstileToken({ token: 'tok', fetchImpl })).resolves.toEqual({ ok: false, reason: 'missing-secret' });

    if (previous !== undefined) process.env.TURNSTILE_SECRET_KEY = previous;
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('TURNSTILE_SECRET_KEY'));
  });

  it('rechaza si Cloudflare dice que el token no vale', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] }));

    await expect(verifyTurnstileToken({ token: 'tok', secret: 's', fetchImpl })).resolves.toEqual({ ok: false, reason: 'rejected' });
  });

  it.each([
    ['HTTP 500', async () => jsonResponse({ success: true }, false, 500)],
    ['un error de red', async () => { throw new TypeError('network'); }],
    ['un timeout', async () => { throw new DOMException('timeout', 'TimeoutError'); }],
    ['una respuesta que no es JSON', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }) as unknown as Response],
  ])('falla cerrada con %s y no revela el secreto', async (_name, fetchImpl) => {
    await expect(verifyTurnstileToken({ token: 'tok', secret: 's3cret', fetchImpl })).resolves.toEqual({ ok: false, reason: 'unavailable' });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('s3cret');
  });
});
