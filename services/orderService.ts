import { collection, getDocs, getDoc, doc, query, where, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Order } from "../types";

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
    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), order);
    return docRef.id;
};

export const updateOrder = async (id: string, order: Partial<Order>): Promise<void> => {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await updateDoc(docRef, order);
};

export const deleteOrder = async (id: string): Promise<void> => {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await deleteDoc(docRef);
};