import { collection, getDocs, getDoc, doc, query, where, addDoc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
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
    const q = query(couponsCol, where("companyId", "==", companyId), where("code", "==", code.toUpperCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const coupon = mapDocToCoupon(snapshot.docs[0]);

    if (!coupon.isActive) return null;
    if (coupon.validUntil && coupon.validUntil < new Date()) return null;

    return coupon;
}

export const createCoupon = async (couponData: Omit<Coupon, 'id'>): Promise<string> => {
    const docRef = await addDoc(couponsCol, {
        ...couponData,
        code: couponData.code.toUpperCase(),
    });
    return docRef.id;
};

export const updateCoupon = async (id: string, couponData: Partial<Omit<Coupon, 'id'>>): Promise<void> => {
    const docRef = doc(db, "coupons", id);
    const updateData = { ...couponData };
    if (updateData.code) {
        updateData.code = updateData.code.toUpperCase();
    }
    await updateDoc(docRef, updateData);
};

export const deleteCoupon = async (id: string): Promise<void> => {
    const docRef = doc(db, "coupons", id);
    await deleteDoc(docRef);
};
