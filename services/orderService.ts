import { collection, getDocs, getDoc, doc, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
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

export const createOrder = async (order: Partial<Order>): Promise<string> => {
    const orderData = {
        ...order,
        date: serverTimestamp(),
        status: 'Pendiente',
    };
    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), orderData);
    return docRef.id;
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

export const updateOrder = async (id: string, order: Partial<Order>): Promise<void> => {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await updateDoc(docRef, order);
};

export const deleteOrder = async (id: string): Promise<void> => {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await deleteDoc(docRef);
};