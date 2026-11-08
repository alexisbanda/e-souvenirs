import { auth } from "./firebase";

/** Estado del pago con tarjeta de una tienda, tal como lo ve el superadmin. Nunca incluye el token. */
export type CardProviderStatus =
    | { provider: null }
    | { provider: 'stripe' }
    | { provider: 'payphone'; storeId: string; taxRate?: number };

export type CardProviderRequest =
    | { companyId: string; provider: 'payphone'; token: string; storeId: string; taxRate?: number }
    | { companyId: string; provider: 'stripe' }
    | { companyId: string; disable: true };

export type CardProviderFailureReason = 'login' | 'forbidden' | 'validation' | 'last-payment-method' | 'not-found' | 'error';

export type CardProviderResult =
    | { ok: true; status: CardProviderStatus }
    | { ok: false; reason: CardProviderFailureReason };

const ENDPOINT = '/.netlify/functions/manage-card-provider';

const send = async (init: (idToken: string) => Promise<Response>): Promise<CardProviderResult> => {
    const user = auth.currentUser;
    if (!user) {
        return { ok: false, reason: 'login' };
    }

    try {
        const response = await init(await user.getIdToken());
        if (response.status === 401) return { ok: false, reason: 'login' };
        if (response.status === 403) return { ok: false, reason: 'forbidden' };
        if (response.status === 404) return { ok: false, reason: 'not-found' };
        if (response.status === 422) {
            const { reason } = await response.json().catch(() => ({ reason: undefined }));
            return { ok: false, reason: reason === 'last-payment-method' ? 'last-payment-method' : 'validation' };
        }
        if (response.status !== 200) {
            throw new Error(`Unexpected status ${response.status}`);
        }
        return { ok: true, status: await response.json() };
    } catch (error) {
        // Solo el mensaje propio: nunca la petición, que puede llevar el token de Payphone.
        console.error('Error managing the card provider:', (error as Error).message);
        return { ok: false, reason: 'error' };
    }
};

/** Proveedor de tarjeta configurado en la tienda (solo superadmin). */
export const getCardProviderStatus = (companyId: string): Promise<CardProviderResult> =>
    send((idToken) => fetch(`${ENDPOINT}?companyId=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
    }));

/** Activa Payphone o Stripe, o desactiva la tarjeta (solo superadmin). */
export const setCardProvider = (request: CardProviderRequest): Promise<CardProviderResult> =>
    send((idToken) => fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(request),
    }));
