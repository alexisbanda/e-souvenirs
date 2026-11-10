import { collection, getDocs, getDoc, doc, query, where, addDoc, updateDoc, deleteDoc, deleteField, Timestamp, limit, UpdateData } from "firebase/firestore";
import { db } from "./firebase";
import { Coupon } from "../types/coupon";

const couponsCol = collection(db, "coupons");

const mapDocToCoupon = (doc: any): Coupon => {
    const data = doc.data();
    return {
        id: doc.id,
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        companyId: data.companyId,
        isActive: data.isActive,
        validUntil: data.validUntil ? (data.validUntil as Timestamp).toDate() : undefined,
        minPurchase: data.minPurchase,
    } as Coupon;
};

export const getCouponsByCompany = async (companyId: string): Promise<Coupon[]> => {
    const q = query(couponsCol, where("companyId", "==", companyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapDocToCoupon);
};

export const getCouponByCode = async (companyId: string, code: string): Promise<Coupon | null> => {
    const q = query(couponsCol, where("companyId", "==", companyId), where("code", "==", code.toUpperCase()), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const coupon = mapDocToCoupon(snapshot.docs[0]);

    if (!coupon.isActive) return null;
    if (coupon.validUntil && coupon.validUntil < new Date()) return null;

    return coupon;
}

// Quita las claves con valor `undefined`, que Firestore rechaza.
const omitUndefined = <T extends Record<string, unknown>>(data: T): Partial<T> => {
    const result: Partial<T> = {};
    for (const key of Object.keys(data) as (keyof T)[]) {
        if (data[key] !== undefined) {
            result[key] = data[key];
        }
    }
    return result;
};

export const createCoupon = async (couponData: Omit<Coupon, 'id'>): Promise<string> => {
    const docRef = await addDoc(couponsCol, omitUndefined({
        ...couponData,
        code: couponData.code.toUpperCase(),
    }));
    return docRef.id;
};

export const updateCoupon = async (id: string, couponData: Partial<Omit<Coupon, 'id'>>): Promise<void> => {
    const docRef = doc(db, "coupons", id);
    const updateData: Record<string, unknown> = omitUndefined(couponData);
    if (updateData.code) {
        updateData.code = (updateData.code as string).toUpperCase();
    }
    if ('validUntil' in couponData && (couponData.validUntil === undefined || couponData.validUntil === null)) {
        updateData.validUntil = deleteField();
    }
    await updateDoc(docRef, updateData as UpdateData<Record<string, unknown>>);
};

export const deleteCoupon = async (id: string): Promise<void> => {
    const docRef = doc(db, "coupons", id);
    await deleteDoc(docRef);
};

export const isCouponCodeTaken = async (companyId: string, code: string, excludeId?: string): Promise<boolean> => {
    const q = query(
        couponsCol,
        where("companyId", "==", companyId),
        where("code", "==", code.toUpperCase()),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return false;
    }
    return snapshot.docs.some(doc => doc.id !== excludeId);
};
