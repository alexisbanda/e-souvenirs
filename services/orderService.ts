import { collection, getDocs, getDoc, doc, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { CustomizationSelection, Order } from "../types";

const ORDERS_COLLECTION = "orders";

const mapDocToOrder = (doc: any): Order => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
    } as Order;
};

export const getOrders = async (companyId?: string, userId?: string): Promise<Order[]> => {
    let q;
    if (companyId) {
        q = query(collection(db, ORDERS_COLLECTION), where("companyId", "==", companyId));
    } else {
        q = collection(db, ORDERS_COLLECTION);
    }

    if (userId) {
        q = query(q, where("userId", "==", userId));
    }

    const orderSnapshot = await getDocs(q);
    return orderSnapshot.docs.map(mapDocToOrder);
};

export const getOrderById = async (id: string): Promise<Order | undefined> => {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return mapDocToOrder(docSnap);
    } else {
        return undefined;
    }
};

export interface ServerOrderRequest {
    companyId: string;
    items: { productId: string; quantity: number; customization?: CustomizationSelection }[];
    couponCode?: string;
    shippingMethodId: string;
    customer: Order['customer'];
    paymentMethod: 'transfer' | 'cash';
}

export type ServerOrderFailureReason = 'login' | 'coupon-invalid' | 'coupon-expired' | 'coupon-min-purchase' | 'validation' | 'error';

export type ServerOrderResult =
    | { ok: true; orderId: string; total: number }
    | { ok: false; reason: ServerOrderFailureReason };

const COUPON_FAILURE_REASONS: Record<string, ServerOrderFailureReason> = {
    invalid: 'coupon-invalid',
    expired: 'coupon-expired',
    'min-purchase': 'coupon-min-purchase',
};

/** Crea un pedido por transferencia o efectivo en el servidor, que calcula el total. */
export const createServerOrder = async (request: ServerOrderRequest): Promise<ServerOrderResult> => {
    const user = auth.currentUser;
    if (!user) {
        return { ok: false, reason: 'login' };
    }

    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/.netlify/functions/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(request),
        });

        if (response.status === 401) return { ok: false, reason: 'login' };
        if (response.status === 422) {
            const { reason } = await response.json().catch(() => ({ reason: undefined }));
            return { ok: false, reason: COUPON_FAILURE_REASONS[reason] ?? 'validation' };
        }
        if (response.status !== 201) {
            throw new Error(`Unexpected status ${response.status}`);
        }

        const { orderId, total } = await response.json();
        return { ok: true, orderId, total };
    } catch (error) {
        console.error('Error creating order:', (error as Error).message);
        return { ok: false, reason: 'error' };
    }
};

export type CardPaymentRequest = Omit<ServerOrderRequest, 'paymentMethod'>;

export type CardPaymentFailureReason = ServerOrderFailureReason | 'card-unavailable' | 'amount-too-low';

export type CardPaymentResult =
    | { ok: true; url: string }
    | { ok: false; reason: CardPaymentFailureReason };

/** Prepara el pago con tarjeta en el servidor, que calcula el importe. Devuelve la URL del proveedor. */
export const createCardPayment = async (request: CardPaymentRequest): Promise<CardPaymentResult> => {
    const user = auth.currentUser;
    if (!user) {
        return { ok: false, reason: 'login' };
    }

    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/.netlify/functions/create-card-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(request),
        });

        if (response.status === 401) return { ok: false, reason: 'login' };
        if (response.status === 422) {
            const { reason } = await response.json().catch(() => ({ reason: undefined }));
            if (reason === 'card-unavailable') return { ok: false, reason: 'card-unavailable' };
            if (reason === 'amount-too-low') return { ok: false, reason: 'amount-too-low' };
            return { ok: false, reason: COUPON_FAILURE_REASONS[reason] ?? 'validation' };
        }
        if (response.status !== 200) {
            throw new Error(`Unexpected status ${response.status}`);
        }

        const { url } = await response.json();
        if (typeof url !== 'string' || !url) throw new Error('Missing payment URL');
        return { ok: true, url };
    } catch (error) {
        console.error('Error creating card payment:', (error as Error).message);
        return { ok: false, reason: 'error' };
    }
};

/** Datos con los que el proveedor devuelve al comprador a la tienda. */
export type CardConfirmation =
    | { provider: 'payphone'; id: string; clientTransactionId: string }
    | { provider: 'stripe'; sessionId: string };

export type ConfirmCardFailureReason = 'login' | 'not-found' | 'not-approved' | 'amount-mismatch' | 'invalid' | 'error';

export type ConfirmCardResult =
    | { ok: true; orderId: string; total: number }
    | { ok: false; reason: ConfirmCardFailureReason };

const CONFIRM_FAILURE_REASONS: Record<number, ConfirmCardFailureReason> = {
    401: 'login',
    404: 'not-found',
    409: 'not-approved',
};

/** Confirma el pago con el proveedor desde el servidor, que crea la orden. Es idempotente. */
export const confirmCardPayment = async (confirmation: CardConfirmation): Promise<ConfirmCardResult> => {
    const user = auth.currentUser;
    if (!user) {
        return { ok: false, reason: 'login' };
    }

    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/.netlify/functions/confirm-card-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(confirmation),
        });

        if (CONFIRM_FAILURE_REASONS[response.status]) return { ok: false, reason: CONFIRM_FAILURE_REASONS[response.status] };
        if (response.status === 422) {
            const { reason } = await response.json().catch(() => ({ reason: undefined }));
            return { ok: false, reason: reason === 'amount-mismatch' ? 'amount-mismatch' : 'invalid' };
        }
        if (response.status !== 200) {
            throw new Error(`Unexpected status ${response.status}`);
        }

        const { orderId, total } = await response.json();
        return { ok: true, orderId, total };
    } catch (error) {
        console.error('Error confirming card payment:', (error as Error).message);
        return { ok: false, reason: 'error' };
    }
};

export const updateOrder = async (id: string, order: Partial<Order>): Promise<void> => {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await updateDoc(docRef, order);
};

export const deleteOrder = async (id: string): Promise<void> => {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await deleteDoc(docRef);
};