const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEFAULT_TIMEOUT_MS = 5000;
// Límite de longitud que documenta Cloudflare para el token.
const MAX_TOKEN_LENGTH = 2048;

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'missing-token' | 'missing-secret' | 'rejected' | 'unavailable' };

interface VerifyTurnstileOptions {
  token: unknown;
  remoteIp?: string;
  secret?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Verifica un token de Turnstile. Falla cerrada: solo `ok: true` deja pasar. */
export const verifyTurnstileToken = async ({
  token,
  remoteIp,
  secret = process.env.TURNSTILE_SECRET_KEY,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: VerifyTurnstileOptions): Promise<TurnstileResult> => {
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: 'missing-token' };
  }

  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not configured: rejecting the request.');
    return { ok: false, reason: 'missing-secret' };
  }

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) {
    form.set('remoteip', remoteIp);
  }

  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.error(`Turnstile siteverify responded with HTTP ${response.status}.`);
      return { ok: false, reason: 'unavailable' };
    }

    const result = await response.json() as { success?: boolean; 'error-codes'?: string[] };
    if (result.success === true) {
      return { ok: true };
    }
    console.warn('Turnstile rejected a token:', result['error-codes'] ?? []);
    return { ok: false, reason: 'rejected' };
  } catch (error) {
    console.error(`Turnstile siteverify failed: ${(error as Error).name}.`);
    return { ok: false, reason: 'unavailable' };
  }
};
