import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "./firebase";

export interface ShippingMethod {
    id: string;
    name: string;
    price: number;
    companyId: string;
}

const shippingMethodsCol = collection(db, "shippingMethods");

export const getShippingMethods = async (companyId?: string): Promise<ShippingMethod[]> => {
    if (companyId) {
        const q = query(shippingMethodsCol, where("companyId", "==", companyId));
        const shippingSnapshot = await getDocs(q);
        return shippingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingMethod));
    } else {
        const shippingSnapshot = await getDocs(shippingMethodsCol);
        return shippingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingMethod));
    }
};

export const createShippingMethod = async (method: Omit<ShippingMethod, 'id'>): Promise<string> => {
    const docRef = await addDoc(shippingMethodsCol, method);
    return docRef.id;
};

export const updateShippingMethod = async (id: string, method: Omit<ShippingMethod, 'id'>): Promise<void> => {
    const docRef = doc(db, "shippingMethods", id);
    await updateDoc(docRef, method);
};

export const deleteShippingMethod = async (id: string): Promise<void> => {
    const docRef = doc(db, "shippingMethods", id);
    await deleteDoc(docRef);
};